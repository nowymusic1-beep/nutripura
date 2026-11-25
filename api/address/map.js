import {adapt} from "../../lib/vercel-adapter.js";
export default adapt(async(req,res)=>{
 res.set("Cache-Control","private, no-store");
 if(req.method!=="GET")return res.status(405).json({error:"Método no permitido"});
 const p=new URL(req.originalUrl,"https://www.nutricionpura.cl").searchParams,lat=Number(p.get("lat")),lon=Number(p.get("lon"));
 if(!p.has("lat")||!p.has("lon")||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<-56||lat>-17||lon<-110||lon>-66)return res.status(400).json({error:"Coordenadas inválidas"});
 if(!process.env.GEOAPIFY_API_KEY)return res.status(503).json({error:"Mapa no configurado"});
 const url=new URL("https://maps.geoapify.com/v1/staticmap");
 for(const [k,v] of Object.entries({style:"osm-bright",width:"600",height:"280",center:"lonlat:"+lon+","+lat,zoom:"16",marker:"lonlat:"+lon+","+lat+";color:%2328553c;size:medium",apiKey:process.env.GEOAPIFY_API_KEY}))url.searchParams.set(k,v.replace("%23","#"));
 try{const r=await fetch(url,{signal:AbortSignal.timeout(6000)});if(!r.ok||!r.headers.get("content-type")?.startsWith("image/"))return res.status(502).json({error:"Mapa no disponible"});res.set("Content-Type",r.headers.get("content-type"));res.set("X-Content-Type-Options","nosniff");res.end(Buffer.from(await r.arrayBuffer()));}catch{return res.status(502).json({error:"Mapa no disponible"});}
});
