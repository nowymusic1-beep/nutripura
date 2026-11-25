import {createHmac, timingSafeEqual, randomBytes} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
import {adapt} from "../lib/vercel-adapter.js";
export async function admin(req,res){
 res.set("Cache-Control","private, no-store, max-age=0");
 res.set("X-Content-Type-Options","nosniff");
 const allowed=new Set(["rokoadmin","ramonadmin"]);
 const password=process.env.ADMIN_SHARED_PASSWORD;
 const secret=process.env.ADMIN_SESSION_SECRET;
 if(!password||password.length<12||!secret||secret.length<32||!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)return res.status(503).json({error:"Panel pendiente de configuración de acceso."});
 const origin=req.get("origin");
 if(origin&&origin!=="https://www.nutricionpura.cl"&&origin!=="https://nutricionpura.cl")return res.status(403).json({error:"Origen no autorizado"});
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
 const mac=(value,key=secret)=>createHmac("sha256",key).update(value).digest("base64url");
 const equal=(a,b)=>timingSafeEqual(Buffer.from(mac(a)),Buffer.from(mac(b)));
 try{
 if(req.method==="POST"){
  const body=typeof req.body==="string"?JSON.parse(req.body):req.body;
  const user=body?.username,pass=body?.password;
  if(typeof user!=="string"||typeof pass!=="string"||user.length>64||pass.length>512)return res.status(400).json({error:"Datos inválidos"});
  const matches=equal(pass,password);
  if(!allowed.has(user)||!matches){await new Promise(r=>setTimeout(r,500));return res.status(401).json({error:"Acceso no autorizado"});}
  const payload=Buffer.from(JSON.stringify({user,exp:Date.now()+3600000,nonce:randomBytes(16).toString("hex")})).toString("base64url");
  return res.status(200).json({token:payload+"."+mac(payload,secret+":"+mac(password))});
 }
 if(req.method!=="GET")return res.status(405).json({error:"Método no permitido"});
 const token=(req.get("authorization")||"").match(/^Bearer (\S+)$/)?.[1];
 if(!token||token.length>2048)return res.status(401).json({error:"Inicia sesión"});
 const parts=token.split(".");
 if(parts.length!==2||!equal(parts[1],mac(parts[0],secret+":"+mac(password))))return res.status(401).json({error:"Acceso no autorizado"});
 let session;try{session=JSON.parse(Buffer.from(parts[0],"base64url").toString("utf8"));}catch{return res.status(401).json({error:"Acceso no autorizado"});}
 if(!allowed.has(session.user)||!Number.isFinite(session.exp)||session.exp<=Date.now())return res.status(401).json({error:"Sesión vencida"});
 const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,options);
 const url=new URL(req.originalUrl,"https://www.nutricionpura.cl");
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
