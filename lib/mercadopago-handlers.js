import {readPrices,confirmTotal,PriceChanged} from "./storefront-prices.js";
import { randomUUID, randomBytes, createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { calculateOrder, validateCustomer, CustomerError } from "./flow-utils.js";

const site = "https://www.nutricionpura.cl";
const hash = s => createHash("sha256").update(s).digest("hex");
const uuid = s => typeof s === "string" && /^[0-9a-f-]{36}$/i.test(s);
const configured = () => process.env.MP_ENABLED === "true" && ["MP_ACCESS_TOKEN","MP_WEBHOOK_SECRET","SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY"].every(k=>process.env[k]);
const db = () => createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const check = r => { if(r.error) throw new Error("Database operation failed"); return r.data; };
async function mp(path, body) {
  const r = await fetch("https://api.mercadopago.com"+path,{method:body?"POST":"GET",headers:{Authorization:"Bearer "+process.env.MP_ACCESS_TOKEN,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
  if(!r.ok) throw new Error("Mercado Pago request failed: "+r.status);
  return r.json();
}
function validOrigin(req){const o=req.get("origin");return !o || o===site || o==="https://nutricionpura.cl";}
function fail(res,e){console.error("Mercado Pago operation failed",e.message);return res.status(502).json({error:"No pudimos procesar el pago. Inténtalo nuevamente."});}
export async function createPayment(req,res){
  if(req.method==="GET") return res.status(200).json({enabled:configured()});
  if(req.method!=="POST") return res.status(405).json({error:"Método no permitido"});
  if(!validOrigin(req)) return res.status(403).json({error:"Origen no autorizado"});
  if(!configured()) return res.status(503).json({error:"Mercado Pago todavía no está disponible."});
  const email=typeof req.body?.email==="string"?req.body.email.trim():"";
  if(email.length>254||!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({error:"Ingresa un correo válido."});
  let prices,editable;try{({prices,editable}=await readPrices(db()));}catch{return res.status(503).json({error:"Precios temporalmente no disponibles"});}
  let customer,cart;
  try{customer=validateCustomer(req.body.customer);cart=calculateOrder(req.body.items,{testProductEnabled:process.env.TEST_PRODUCT_ENABLED==="1",prices});confirmTotal(cart,req.body.expectedTotal,editable);}
  catch(e){if(e instanceof PriceChanged)return res.status(409).json({error:e.message,code:"PRICE_CHANGED",prices});return res.status(400).json({error:e instanceof CustomerError?e.message:"Carrito no válido",...(e instanceof CustomerError?{field:e.field}:{})});}
  const id=randomUUID(), token=randomBytes(32).toString("hex"), eventId=randomUUID();
  try{
    const d=db();
    check(await d.from("mercadopago_orders").insert({id,token_hash:hash(token),email,customer,items:cart.items,subtotal:cart.subtotal,discount:cart.discount,shipping:cart.shipping,amount:cart.amount,status:"pending",meta_event_id:eventId}));
    const back=site+"/?mp=return&mp_token="+token;
    const pref=await mp("/checkout/preferences",{items:[{id,title:"Pedido Nutrición Pura",quantity:1,currency_id:"CLP",unit_price:cart.amount}],payer:{email},external_reference:id,back_urls:{success:back,pending:back,failure:back},auto_return:"approved",notification_url:site+"/api/mercadopago/webhook?source_news=webhooks"});
    const url=new URL(pref.init_point);
    if(url.protocol!=="https:"||!["www.mercadopago.cl","www.mercadopago.com","mercadopago.cl","mercadopago.com"].includes(url.hostname)) throw new Error("Invalid checkout URL");
    check(await d.from("mercadopago_orders").update({preference_id:pref.id}).eq("id",id));
    return res.status(200).json({checkoutUrl:url.href});
  }catch(e){return fail(res,e);}
}
export function validSignature(signature,requestId,paymentId,secret){
  const fields=Object.fromEntries(String(signature||"").split(",").map(p=>p.trim().split("=")));
  if(!secret||!requestId||!paymentId||!/^\d+$/.test(fields.ts||"")||! /^[a-f0-9]{64}$/i.test(fields.v1||""))return false;
  const expected=createHmac("sha256",secret).update("id:"+paymentId.toLowerCase()+";request-id:"+requestId+";ts:"+fields.ts+";").digest();
  return timingSafeEqual(expected,Buffer.from(fields.v1,"hex"));
}
export function paymentMatches(p,o){return p.external_reference===o.id&&p.currency_id==="CLP"&&Number(p.transaction_amount)===o.amount&&p.live_mode===true;}
async function reconcile(d,p,o){
  if(!paymentMatches(p,o))return;
  const status=p.status==="approved"?"paid":["refunded","charged_back"].includes(p.status)?"refunded":["rejected","cancelled"].includes(p.status)?"failed":"pending";
  let q=d.from("mercadopago_orders").update({status,payment_id:String(p.id),updated_at:new Date().toISOString()}).eq("id",o.id);
  if(status==="refunded") q=q.eq("payment_id",String(p.id));
  else if(status==="paid") q=q.in("status",["pending","failed","paid"]).or("payment_id.is.null,payment_id.eq."+String(p.id));
  else q=q.in("status",["pending","failed"]);
  check(await q);
}
export async function webhook(req,res){
  if(req.method==="GET")return res.status(200).json({endpoint:"mercadopago-webhook",configured:configured()});
  if(req.method!=="POST")return res.status(405).send("Method not allowed");
  if(!configured())return res.status(503).send("Not configured");
  const url=new URL(req.originalUrl,site), id=url.searchParams.get("data.id");
  if(!id||!/^\d+$/.test(id)||!validSignature(req.get("x-signature"),req.get("x-request-id"),id,process.env.MP_WEBHOOK_SECRET))return res.status(401).send("Invalid signature");
  if((url.searchParams.get("type")||req.body?.type)!=="payment")return res.status(200).send("OK");
  try{const p=await mp("/v1/payments/"+id);if(!uuid(p.external_reference))return res.status(200).send("OK");
    const d=db(),o=check(await d.from("mercadopago_orders").select("*").eq("id",p.external_reference).maybeSingle());
    if(o)await reconcile(d,p,o);return res.status(200).send("OK");
  }catch(e){return fail(res,e);}
}
export async function status(req,res){
  res.set("Cache-Control","no-store");
  if(req.method!=="POST")return res.status(405).json({error:"Método no permitido"});
  if(!validOrigin(req))return res.status(403).json({error:"Origen no autorizado"});
  if(!configured())return res.status(503).json({error:"Mercado Pago no disponible"});
  const token=req.body?.token;if(typeof token!=="string"||!/^[a-f0-9]{64}$/.test(token))return res.status(400).json({error:"Identificador inválido"});
  try{const d=db();let o=check(await d.from("mercadopago_orders").select("*").eq("token_hash",hash(token)).maybeSingle());
    if(!o)return res.status(404).json({error:"Pedido no encontrado"});
    if(o.status==="pending"||o.status==="failed"){
      const list=await mp("/v1/payments/search?external_reference="+encodeURIComponent(o.id));
      const p=(list.results||[]).find(p=>paymentMatches(p,o)&&p.status==="approved");
      if(p){await reconcile(d,p,o);o=check(await d.from("mercadopago_orders").select("*").eq("id",o.id).single());}
    }
    return res.status(200).json({status:o.status,firstName:o.customer.firstName,amount:o.amount,currency:"CLP",items:o.items.map(({id,quantity})=>({id,quantity})),eventId:o.meta_event_id});
  }catch(e){return fail(res,e);}
}
