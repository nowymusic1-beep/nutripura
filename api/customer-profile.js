import {createClient} from "@supabase/supabase-js";
import {adapt} from "../lib/vercel-adapter.js";
export default adapt(async(req,res)=>{
 res.set("Cache-Control","private, no-store");
 if(req.method!=="POST")return res.status(405).json({error:"Método no permitido"});
 if(!["https://www.nutricionpura.cl","https://nutricionpura.cl"].includes(req.get("origin")))return res.status(403).json({error:"Origen no autorizado"});
 const {SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:key,SUPABASE_SERVICE_ROLE_KEY:service}=process.env;
 if(!url||!key||!service)return res.status(503).json({error:"Recuperación de cuenta aún no habilitada. Puedes comprar sin registrarte."});
 const body=typeof req.body==="string"?JSON.parse(req.body):req.body;
 const email=typeof body?.email==="string"?body.email.trim().toLowerCase():"";
 if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))return res.status(400).json({error:"Correo inválido"});
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
 try{
 const auth=createClient(url,key,options);
 if(body.action==="send"){
  const {error}=await auth.auth.signInWithOtp({email,options:{shouldCreateUser:true}});
  if(error)return res.status(429).json({error:"No pudimos enviar el código. Intenta más tarde."});
  return res.json({sent:true});
 }
 if(body.action!=="verify"||typeof body.code!=="string"||!/^\d{6,8}$/.test(body.code))return res.status(400).json({error:"Código inválido"});
 const {data,error}=await auth.auth.verifyOtp({email,token:body.code,type:"email"});
 if(error||data.user?.email?.toLowerCase()!==email||!data.user?.email_confirmed_at)return res.status(401).json({error:"Código incorrecto o vencido"});
 const db=createClient(url,service,options);
 const results=await Promise.all(["flow_orders","mercadopago_orders"].map(table=>db.from(table).select("customer,created_at").eq("email",email).eq("status","paid").not("customer","is",null).order("created_at",{ascending:false}).limit(1)));
 const candidates=results.flatMap(r=>r.error?[]:r.data||[]).sort((a,b)=>b.created_at.localeCompare(a.created_at));
 const customer=candidates[0]?.customer;
 if(!customer)return res.json({customer:null});
 return res.json({customer:Object.fromEntries(["firstName","lastName","phone","region","comuna","address","unit","notes"].filter(k=>typeof customer[k]==="string").map(k=>[k,customer[k]]))});
 }catch{return res.status(502).json({error:"No pudimos recuperar los datos."});}
});
