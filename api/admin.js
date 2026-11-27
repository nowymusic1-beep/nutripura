import {readPrices,validPrice,DEFAULT_PRICES,validPromotions} from "../lib/storefront-prices.js";
import {createHmac, timingSafeEqual, randomBytes} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
import {adapt} from "../lib/vercel-adapter.js";
export async function admin(req,res){
 res.set("Cache-Control","private, no-store, max-age=0");
 res.set("X-Content-Type-Options","nosniff");
 const allowed=new Set(["rokoadmin","ramonadmin"]);
 const password=process.env.ADMIN_SHARED_PASSWORD;
 const secret=process.env.ADMIN_SESSION_SECRET;
 const passOk=!!password&&password.length>=12;
 const googleId=process.env.GOOGLE_CLIENT_ID||"";
 const emails=new Set((process.env.ADMIN_ALLOWED_EMAILS||"").toLowerCase().split(",").map(e=>e.trim()).filter(Boolean));
 const googleOn=!!googleId&&emails.size>0;
 if((!passOk&&!googleOn)||!secret||secret.length<32||!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)return res.status(503).json({error:"Panel pendiente de configuración de acceso."});
 const origin=req.get("origin");
 if(origin&&origin!=="https://www.nutricionpura.cl"&&origin!=="https://nutricionpura.cl")return res.status(403).json({error:"Origen no autorizado"});
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
 const mac=(value,key=secret)=>createHmac("sha256",key).update(value).digest("base64url");
 const equal=(a,b)=>timingSafeEqual(Buffer.from(mac(a)),Buffer.from(mac(b)));
 const signKey=secret+":"+mac(password||"");
 try{
 if(req.method==="GET"&&new URL(req.originalUrl,"https://www.nutricionpura.cl").searchParams.get("section")==="config")return res.json({googleClientId:googleOn?googleId:null,passwordLogin:passOk});
 if(req.method==="POST"){
  const body=typeof req.body==="string"?JSON.parse(req.body):req.body;
  if(typeof body?.credential==="string"){
   if(!googleOn||body.credential.length>4096)return res.status(401).json({error:"Acceso no autorizado"});
   let info;try{const r=await fetch("https://oauth2.googleapis.com/tokeninfo?id_token="+encodeURIComponent(body.credential),{signal:AbortSignal.timeout(5000)});if(!r.ok)throw 0;info=await r.json();}catch{await new Promise(r=>setTimeout(r,500));return res.status(401).json({error:"Acceso no autorizado"});}
   const email=String(info.email||"").toLowerCase();
   const valid=info.aud===googleId&&["accounts.google.com","https://accounts.google.com"].includes(info.iss)&&String(info.email_verified)==="true"&&Number(info.exp)*1000>Date.now()&&emails.has(email);
   if(!valid){await new Promise(r=>setTimeout(r,500));return res.status(401).json({error:"Esta cuenta de Google no tiene acceso."});}
   const payload=Buffer.from(JSON.stringify({user:email,exp:Date.now()+3600000,nonce:randomBytes(16).toString("hex")})).toString("base64url");
   return res.status(200).json({token:payload+"."+mac(payload,signKey)});
  }
  if(!passOk)return res.status(401).json({error:"Acceso no autorizado"});
  const user=body?.username,pass=body?.password;
  if(typeof user!=="string"||typeof pass!=="string"||user.length>64||pass.length>512)return res.status(400).json({error:"Datos inválidos"});
  const matches=equal(pass,password);
  if(!allowed.has(user)||!matches){await new Promise(r=>setTimeout(r,500));return res.status(401).json({error:"Acceso no autorizado"});}
  const payload=Buffer.from(JSON.stringify({user,exp:Date.now()+3600000,nonce:randomBytes(16).toString("hex")})).toString("base64url");
  return res.status(200).json({token:payload+"."+mac(payload,signKey)});
 }
 if(!["GET","PATCH"].includes(req.method))return res.status(405).json({error:"Método no permitido"});
 const token=(req.get("authorization")||"").match(/^Bearer (\S+)$/)?.[1];
 if(!token||token.length>2048)return res.status(401).json({error:"Inicia sesión"});
 const parts=token.split(".");
 if(parts.length!==2||!equal(parts[1],mac(parts[0],signKey)))return res.status(401).json({error:"Acceso no autorizado"});
 let session;try{session=JSON.parse(Buffer.from(parts[0],"base64url").toString("utf8"));}catch{return res.status(401).json({error:"Acceso no autorizado"});}
 if(!((passOk&&allowed.has(session.user))||(googleOn&&emails.has(session.user)))||!Number.isFinite(session.exp)||session.exp<=Date.now())return res.status(401).json({error:"Sesión vencida"});
 const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,options);
 const url=new URL(req.originalUrl,"https://www.nutricionpura.cl");
 if(url.searchParams.get("section")==="promotions"){
  if(req.method==="GET")return res.json(await readPrices(db));
  if(!origin)return res.status(403).json({error:"Origen no autorizado"});
  const body=typeof req.body==="string"?JSON.parse(req.body):req.body;
  if(!body||!Object.hasOwn(DEFAULT_PRICES,body.id)||!validPromotions(body.promotions))return res.status(400).json({error:"Promoción inválida"});
  const current=await readPrices(db);if(!current.promoEditable)return res.status(503).json({error:"Falta activar las promociones en Supabase"});
  const entries=Object.entries(body.promotions).sort((a,b)=>Number(a[0])-Number(b[0]));
  if(entries.some(([q,n],i)=>n>current.prices[body.id]*Number(q)-Math.round(current.prices[body.id]*Number(q)*.1)||(i>0&&(n<=entries[i-1][1]||n*Number(entries[i-1][0])>=entries[i-1][1]*Number(q)))))return res.status(400).json({error:"El total debe aumentar, el precio por unidad debe bajar y ningún pack puede superar el precio web habitual."});
  const {error}=await db.from("storefront_prices").update({promotions:body.promotions,updated_by:session.user,updated_at:new Date().toISOString()}).eq("id",body.id);
  if(error)throw new Error("No se pudo guardar promoción");return res.json(await readPrices(db));
 }
 if(url.searchParams.get("section")==="prices"){
  if(req.method==="GET")return res.json(await readPrices(db));
  if(!origin)return res.status(403).json({error:"Origen no autorizado"});
  const body=typeof req.body==="string"?JSON.parse(req.body):req.body;
  if(!body||!Object.hasOwn(DEFAULT_PRICES,body.id)||!validPrice(body.price))return res.status(400).json({error:"Precio inválido (entre $1.000 y $1.000.000 CLP)"});
  const current=await readPrices(db);if(!current.editable)return res.status(503).json({error:"Falta activar tabla de precios en Supabase"});
  if(!validPrice(body.previousPrice))return res.status(400).json({error:"Precio anterior inválido"});
  if(Object.entries(current.promotions?.[body.id]||{}).some(([q,n])=>n>body.price*Number(q)-Math.round(body.price*Number(q)*.1)))return res.status(400).json({error:"Desactiva o modifica los packs antes de bajar el precio base."});
  const {data,error}=await db.from("storefront_prices").update({price_clp:body.price,updated_by:session.user,updated_at:new Date().toISOString()}).eq("id",body.id).eq("price_clp",body.previousPrice).select("id");
  if(error)throw new Error("No se pudo guardar precio");
  if(!data?.length)return res.status(409).json({error:"Otro administrador cambió el precio. Actualiza y vuelve a intentar."});
  return res.json(await readPrices(db));
 }
 if(req.method!=="GET")return res.status(405).json({error:"Método no permitido"});
 const days=Number(url.searchParams.get("days")||30);
 if(![7,30,90].includes(days))return res.status(400).json({error:"Periodo inválido"});
 const since=new Date(Date.now()-days*86400000).toISOString();
 const fields="id,email,customer,items,subtotal,discount,amount,status,created_at,updated_at";
 const sources=await Promise.all(["flow_orders","mercadopago_orders"].map(async table=>{
  let rows=[],partial=false;
  for(let start=0;start<5000;start+=500){
   const query=cols=>db.from(table).select(cols).gte("created_at",since).order("created_at",{ascending:false}).order("id").range(start,start+499);
   let r=await query(fields);if(table==="flow_orders"&&["42703","PGRST204"].includes(r.error?.code))r=await query(fields.replace("customer,",""));
   if(r.error)return {provider:table==="flow_orders"?"Flow":"Mercado Pago",error:true,rows:[]};
   rows.push(...r.data);if(r.data.length<500)break;if(start===4500)partial=true;
  }
  return {provider:table==="flow_orders"?"Flow":"Mercado Pago",partial,rows:rows.map(r=>({...r,provider:table==="flow_orders"?"Flow":"Mercado Pago"}))};
 }));
 const orders=sources.flatMap(s=>s.rows).sort((a,b)=>b.created_at.localeCompare(a.created_at));
 return res.status(200).json({orders,coverage:sources.map(({rows,...s})=>s),since,days});
 }catch(e){console.error("Admin request failed",e.name);return res.status(502).json({error:"No se pudo consultar el panel."});}
}
export default adapt(admin);
