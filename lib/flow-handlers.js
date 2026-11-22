import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { calculateOrder, mapFlowStatus, signFlowParams } from "./flow-utils.js";
import { createMetaEvent } from "./meta-utils.js";

const flowApiBase = "https://www.flow.cl/api";
const metaPixelId = "1089358126319120";
const metaGraphApiVersion = "v27.0";
const siteUrl = new URL(process.env.SITE_URL || "http://localhost:3000").origin;
const publicReturnUrl = process.env.FLOW_RETURN_URL || `${siteUrl}/?flow=return`;
const flowConfirmationUrl =
  process.env.FLOW_CONFIRMATION_URL || `${siteUrl}/api/flow/confirmation`;
// Validate configuration within request handlers, so missing credentials return a useful 503 instead of failing module initialization.
const allowedOrigins = new Set([
  ...[
    "https://nutricionpura.cl",
    "https://www.nutricionpura.cl",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    siteUrl,
    ...(process.env.ALLOWED_ORIGINS || "").split(",").map((origin) => origin.trim()),
  ].filter(Boolean),
]);

let supabase;
const memoryOrders = new Map();
let warnedMockSupabase = false;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function createMemorySupabase() {
  if (!warnedMockSupabase) {
    warnedMockSupabase = true;
    console.warn("[AI Studio] Supabase not configured — using in-memory order store");
  }
  return {
    from(table) {
      if (table !== "flow_orders") {
        throw new Error(`Unsupported mock table: ${table}`);
      }
      return {
        async insert(row) {
          const now = new Date().toISOString();
          const stored = {
            meta_purchase_claimed_at: null,
            meta_purchase_sent_at: null,
            created_at: now,
            updated_at: now,
            ...row,
          };
          memoryOrders.set(stored.id, stored);
          return { error: null };
        },
        select() {
          return {
            eq(field, value) {
              return {
                async maybeSingle() {
                  for (const row of memoryOrders.values()) {
                    if (row[field] === value) {
                      return { data: { ...row }, error: null };
                    }
                  }
                  return { data: null, error: null };
                },
              };
            },
          };
        },
        update(patch) {
          return {
            eq(field, value) {
              let updated = null;
              for (const [id, row] of memoryOrders.entries()) {
                if (row[field] === value) {
                  updated = { ...row, ...patch };
                  memoryOrders.set(id, updated);
                  break;
                }
              }
              const result = Promise.resolve({ error: null });
              result.select = () => ({
                async single() {
                  return updated
                    ? { data: { ...updated }, error: null }
                    : { data: null, error: { code: "PGRST116" } };
                },
              });
              return result;
            },
          };
        },
      };
    },
    async rpc(fnName, params) {
      if (fnName !== "claim_flow_meta_purchase") {
        return { data: null, error: { code: "MOCK_UNSUPPORTED" } };
      }
      const row = memoryOrders.get(params?.p_order_id);
      if (!row || !row.marketing_consent || row.meta_purchase_sent_at) {
        return { data: [], error: null };
      }
      const now = Date.now();
      const claimedAt = row.meta_purchase_claimed_at
        ? Date.parse(row.meta_purchase_claimed_at)
        : 0;
      if (claimedAt && now - claimedAt < 60_000) {
        return { data: [], error: null };
      }
      const updated = { ...row, meta_purchase_claimed_at: new Date(now).toISOString() };
      memoryOrders.set(updated.id, updated);
      return { data: [{ ...updated }], error: null };
    },
  };
}

function getSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return createMemorySupabase();
  }
  supabase ??= createClient(
    requiredEnv("SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  return supabase;
}

function checkDatabaseError(error, operation) {
  if (!error) return;
  console.error(`Supabase ${operation} failed`, { code: error.code });
  throw new Error(`Could not ${operation} payment order.`);
}

function fromDatabase(row) {
  return {
    id: row.id,
    commerceOrder: row.commerce_order,
    email: row.email,
    items: row.items,
    subtotal: row.subtotal,
    discount: row.discount,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    marketingConsent: row.marketing_consent,
    metaEventId: row.meta_event_id,
    metaEventSourceUrl: row.meta_event_source_url,
    metaFbp: row.meta_fbp,
    metaFbc: row.meta_fbc,
    metaUserAgent: row.meta_user_agent,
  };
}

function isAllowedOrigin(origin, req) {
  if (allowedOrigins.has(origin)) return true;
  const host = req.get("x-forwarded-host") || req.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function setCors(req, res) {
  const origin = req.get("origin");
  if (origin && !isAllowedOrigin(origin, req)) {
    res.status(403).json({ error: "Origen no autorizado." });
    return false;
  }
  if (origin) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
  }
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).send("");
    return false;
  }
  return true;
}


async function postToFlow(path, params) {
  const body = new URLSearchParams(params);
  body.set("s", signFlowParams(params, requiredEnv("FLOW_SECRET_KEY")));

  const response = await fetch(`${flowApiBase}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(15000),
  });

  const result = await response.json();

  if (!response.ok || result?.code) {
    const rawFlowMessage =
      result?.message ??
      result?.msg ??
      result?.error_description ??
      result?.error;

    const flowMessage =
      typeof rawFlowMessage === "string"
        ? rawFlowMessage.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 300)
        : undefined;

    console.error("Flow API request failed", {
      path,
      httpStatus: response.status,
      flowCode: result?.code,
      ...(flowMessage ? { flowMessage } : {}),
    });

    throw new Error("No fue posible comunicarse con Flow.");
  }

  return result;
}


async function sendMetaEvent(eventName, order) {
  if (!order.marketingConsent) return false;
  const endpoint = new URL(
    `https://graph.facebook.com/${metaGraphApiVersion}/${metaPixelId}/events`,
  );
  endpoint.searchParams.set("access_token", requiredEnv("META_CAPI_ACCESS_TOKEN"));
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: [createMetaEvent(eventName, order)] }),
    signal: AbortSignal.timeout(5000),
  });
  const result = await response.json();
  if (!response.ok || result?.error || result?.events_received !== 1) {
    console.error("Meta Conversions API rejected an event", {
      eventName,
      httpStatus: response.status,
      code: result?.error?.code,
    });
    return false;
  }
  return true;
}

async function sendMetaEventSafely(eventName, order) {
  try {
    return await sendMetaEvent(eventName, order);
  } catch {
    console.error("Meta Conversions API request failed", { eventName });
    return false;
  }
}

async function sendMetaPurchaseOnce(orderId) {
  const { data, error } = await getSupabase().rpc("claim_flow_meta_purchase", {
    p_order_id: orderId,
  });
  checkDatabaseError(error, "claim Meta purchase event for");
  const claimed = Array.isArray(data) ? data[0] : data;
  if (!claimed) return;

  const sent = await sendMetaEventSafely("Purchase", fromDatabase(claimed));
  const { error: updateError } = await getSupabase()
    .from("flow_orders")
    .update({
      meta_purchase_claimed_at: null,
      ...(sent ? { meta_purchase_sent_at: new Date().toISOString() } : {}),
    })
    .eq("id", orderId);
  checkDatabaseError(updateError, "release Meta purchase event claim for");
}

function getMetaCookie(value) {
  return typeof value === "string" && value.startsWith("fb.") && value.length <= 200
    ? value
    : null;
}

function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

function getRequestToken(req) {
  if (typeof req.body?.token === "string") return req.body.token;
  if (typeof req.body === "string") {
    return new URLSearchParams(req.body).get("token");
  }
  return new URL(req.originalUrl, siteUrl).searchParams.get("token");
}

async function verifyFlowPayment(token, order) {
  const result = await postToFlow("/payment/getStatus", {
    apiKey: requiredEnv("FLOW_API_KEY"),
    token,
  });
  if (
    String(result.commerceOrder) !== order.commerceOrder ||
    Number(result.amount) !== order.amount ||
    result.currency !== "CLP"
  ) {
    console.error("Flow payment details did not match the stored order", {
      orderId: order.commerceOrder,
    });
    throw new Error("Los datos del pago no coinciden con el pedido.");
  }
  return mapFlowStatus(Number(result.status));
}

async function lookupOrder(token) {
  const { data, error } = await getSupabase()
    .from("flow_orders")
    .select("*")
    .eq("flow_token_hash", tokenHash(token))
    .maybeSingle();
  checkDatabaseError(error, "look up");
  return data ? { order: fromDatabase(data) } : null;
}

async function updatePaymentStatus(token, found) {
  const status = await verifyFlowPayment(token, found.order);
  const { data, error } = await getSupabase()
    .from("flow_orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", found.order.id)
    .select("*")
    .single();
  checkDatabaseError(error, "update");
  if (status === "paid") await sendMetaPurchaseOnce(found.order.id);
  const order = fromDatabase(data);
  return {
    status,
    eventId: order.metaEventId,
    amount: order.amount,
    currency: order.currency,
    items: order.items.map(({ id, quantity }) => ({ id, quantity })),
  };
}

export async function createFlowPayment(req, res) {
  if (!setCors(req, res)) return;
  if (req.method !== "POST") {
    res.set("Allow", "POST, OPTIONS").status(405).json({ error: "Método no permitido." });
    return;
  }
  try {
    const missing = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "FLOW_API_KEY", "FLOW_SECRET_KEY", "SITE_URL"].filter(name => !process.env[name]);
    if (missing.length) {
      console.error("Flow configuration incomplete", { missing });
      res.status(503).json({ error: "El sistema de pagos está temporalmente no disponible. Estamos revisando la configuración." });
      return;
    }
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      res.status(400).json({ error: "Ingresa un correo electrónico válido." });
      return;
    }
    let cart;
    try {
      cart = calculateOrder(req.body?.items);
    } catch {
      res.status(400).json({ error: "El carrito no es válido." });
      return;
    }
    const orderId = randomUUID();
    const commerceOrder = orderId;
    const marketingConsent = req.body?.marketingConsent === true;
    const eventId =
      typeof req.body?.eventId === "string" &&
      /^[a-zA-Z0-9._:-]{1,100}$/.test(req.body.eventId)
        ? req.body.eventId
        : randomUUID();
    const origin = req.get("origin");
    const requestOrigin = origin && isAllowedOrigin(origin, req) ? origin : siteUrl;
    const returnUrl = process.env.FLOW_RETURN_URL || `${requestOrigin}/?flow=return`;
    const confirmationUrl =
      process.env.FLOW_CONFIRMATION_URL || `${requestOrigin}/api/flow/confirmation`;
    const order = {
      id: orderId,
      commerceOrder,
      email,
      items: cart.items,
      subtotal: cart.subtotal,
      discount: cart.discount,
      amount: cart.amount,
      currency: "CLP",
      status: "creating",
      marketingConsent,
      metaEventId: eventId,
      metaEventSourceUrl:
        marketingConsent && origin && isAllowedOrigin(origin, req) ? `${origin}/` : `${siteUrl}/`,
      metaFbp: marketingConsent ? getMetaCookie(req.body?.fbp) : null,
      metaFbc: marketingConsent ? getMetaCookie(req.body?.fbc) : null,
      metaUserAgent: marketingConsent ? req.get("user-agent")?.slice(0, 1000) ?? null : null,
    };
    const { error: insertError } = await getSupabase().from("flow_orders").insert({
      id: orderId,
      commerce_order: commerceOrder,
      email,
      items: cart.items,
      subtotal: cart.subtotal,
      discount: cart.discount,
      amount: cart.amount,
      currency: "CLP",
      status: "creating",
      marketing_consent: marketingConsent,
      meta_event_id: eventId,
      meta_event_source_url: order.metaEventSourceUrl,
      meta_fbp: order.metaFbp,
      meta_fbc: order.metaFbc,
      meta_user_agent: order.metaUserAgent,
    });
    checkDatabaseError(insertError, "create");

    let flowPayment;
    try {
      flowPayment = await postToFlow("/payment/create", {
        apiKey: requiredEnv("FLOW_API_KEY"),
        commerceOrder,
        subject: `Compra Nutrición Pura (${cart.items.length} producto${cart.items.length > 1 ? "s" : ""})`,
        currency: "CLP",
        amount: String(cart.amount),
        email,
        urlReturn: returnUrl,
        urlConfirmation: confirmationUrl,
      });
    } catch (error) {
      const { error: updateError } = await getSupabase()
        .from("flow_orders")
        .update({ status: "initiation_failed", updated_at: new Date().toISOString() })
        .eq("id", orderId);
      checkDatabaseError(updateError, "mark failed");
      throw error;
    }
    if (
      !flowPayment ||
      typeof flowPayment.url !== "string" ||
      typeof flowPayment.token !== "string"
    ) {
      const { error: updateError } = await getSupabase()
        .from("flow_orders")
        .update({ status: "initiation_failed", updated_at: new Date().toISOString() })
        .eq("id", orderId);
      checkDatabaseError(updateError, "mark failed");
      throw new Error("Flow devolvió una respuesta de pago incompleta.");
    }

    const { error: updateError } = await getSupabase()
      .from("flow_orders")
      .update({
        flow_order: flowPayment.flowOrder ?? null,
        flow_token_hash: tokenHash(flowPayment.token),
        status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);
    checkDatabaseError(updateError, "save Flow payment details for");

    await sendMetaEventSafely("InitiateCheckout", order);
    const checkoutUrl = new URL(flowPayment.url);
    checkoutUrl.searchParams.set("token", flowPayment.token);
    res.status(200).json({ checkoutUrl: checkoutUrl.toString() });
  } catch (error) {
    console.error("Could not create Flow payment", { message: error.message });
    res.status(502).json({ error: "No pudimos iniciar el pago. Inténtalo nuevamente." });
  }
}

export async function getFlowPaymentStatus(req, res) {
  if (!setCors(req, res)) return;
  if (req.method !== "POST") {
    res.set("Allow", "POST, OPTIONS").status(405).json({ error: "Método no permitido." });
    return;
  }
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  if (!token || token.length > 512) {
    res.status(400).json({ error: "Falta el identificador de pago." });
    return;
  }
  try {
    const found = await lookupOrder(token);
    if (!found) {
      res.status(404).json({ error: "No encontramos el pedido asociado al pago." });
      return;
    }
    const payment = await updatePaymentStatus(token, found);
    res.status(200).json(payment);
  } catch (error) {
    console.error("Could not verify Flow payment", { message: error.message });
    res.status(502).json({ error: "No pudimos verificar el pago. Inténtalo nuevamente." });
  }
}

export async function flowConfirmation(req, res) {
  if (req.method !== "POST") {
    res.set("Allow", "POST").status(405).send("Method not allowed");
    return;
  }
  const token = getRequestToken(req);
  if (!token || token.length > 512) {
    res.status(400).send("Missing payment token");
    return;
  }
  try {
    const found = await lookupOrder(token);
    if (!found) {
      res.status(404).send("Order not found");
      return;
    }
    await updatePaymentStatus(token, found);
    res.status(200).send("OK");
  } catch (error) {
    console.error("Flow confirmation could not be processed", { message: error.message });
    res.status(502).send("Unable to confirm payment");
  }
}
