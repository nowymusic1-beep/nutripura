import { createHmac } from "node:crypto";

export const SHIPPING_FEE = 3990;

const products = Object.freeze({
  berberina: Object.freeze({ name: "Berberina Nutre Pure", price: 24990 }),
  magnesio: Object.freeze({ name: "Magnesium Complex Nutre Pure", price: 14850 }),
});

export function calculateOrder(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 2) {
    throw new Error("El carrito no es válido.");
  }
  const normalized = [];
  const seen = new Set();
  for (const item of items) {
    const product = products[item?.id];
    const quantity = item?.quantity;
    if (
      !product ||
      seen.has(item.id) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 99
    ) {
      throw new Error("El carrito no es válido.");
    }
    seen.add(item.id);
    normalized.push({
      id: item.id,
      name: product.name,
      quantity,
      unitPrice: product.price,
    });
  }
  const subtotal = normalized.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const discount = Math.round(subtotal * 0.1);
  return { items: normalized, subtotal, discount, shipping: SHIPPING_FEE, amount: subtotal - discount + SHIPPING_FEE };
}

export function signFlowParams(params, secret) {
  const canonical = Object.keys(params)
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join("");
  return createHmac("sha256", secret).update(canonical).digest("hex");
}

export function mapFlowStatus(status) {
  if (status === 2) return "paid";
  if (status === 1) return "pending";
  if (status === 5) return "refunded";
  if (status === 3 || status === 4) return "failed";
  return "pending";
}

export const REGIONS = Object.freeze([
  "Arica y Parinacota", "Tarapacá", "Antofagasta", "Atacama", "Coquimbo", "Valparaíso",
  "Metropolitana de Santiago", "Libertador General Bernardo O'Higgins", "Maule", "Ñuble",
  "Biobío", "La Araucanía", "Los Ríos", "Los Lagos", "Aysén del General Carlos Ibáñez del Campo",
  "Magallanes y de la Antártica Chilena",
]);

export class CustomerError extends Error {
  constructor(field, message) {
    super(message);
    this.field = field;
  }
}

function cleanText(value, max) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

// Acepta 912345678, 9 1234 5678, +56 9 1234 5678 o 56912345678 y devuelve +56912345678.
export function normalizeChileanPhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "").replace(/^56/, "");
  return /^9\d{8}$/.test(digits) ? `+56${digits}` : null;
}

export function validateCustomer(input) {
  const firstName = cleanText(input?.firstName, 60);
  const lastName = cleanText(input?.lastName, 60);
  const region = cleanText(input?.region, 80);
  const comuna = cleanText(input?.comuna, 80);
  const address = cleanText(input?.address, 150);
  const unit = cleanText(input?.unit, 60);
  const notes = cleanText(input?.notes, 200);
  const namePattern = /^[\p{L}][\p{L}\s'.-]*$/u;
  if (!firstName || !namePattern.test(firstName)) throw new CustomerError("firstName", "Ingresa tu nombre.");
  if (!lastName || !namePattern.test(lastName)) throw new CustomerError("lastName", "Ingresa tu apellido.");
  const phone = normalizeChileanPhone(input?.phone);
  if (!phone) throw new CustomerError("phone", "Ingresa un celular chileno de 9 dígitos, por ejemplo 9 1234 5678.");
  if (!REGIONS.includes(region)) throw new CustomerError("region", "Elige tu región.");
  if (comuna.length < 2) throw new CustomerError("comuna", "Ingresa tu comuna.");
  if (address.length < 4 || !/\d/.test(address)) {
    throw new CustomerError("address", "Ingresa la calle y el número de tu dirección.");
  }
  return { firstName, lastName, phone, region, comuna, address, unit, notes };
}

// Datos que Flow guarda junto al pago y muestra en su panel.
export function flowOptionalData(customer) {
  return JSON.stringify({
    Nombre: `${customer.firstName} ${customer.lastName}`,
    Telefono: customer.phone,
    Region: customer.region,
    Comuna: customer.comuna,
    Direccion: customer.address,
    Depto: customer.unit || "-",
    Indicaciones: customer.notes || "-",
  });
}

export function firstNameFromFlowOptional(optional) {
  try {
    const data = typeof optional === "string" ? JSON.parse(optional) : optional;
    const name = typeof data?.Nombre === "string" ? data.Nombre.trim().split(" ")[0] : "";
    return name ? name.slice(0, 60) : null;
  } catch {
    return null;
  }
}
