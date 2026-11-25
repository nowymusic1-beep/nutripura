import {createClient} from "@supabase/supabase-js";
export const DEFAULT_PRICES=Object.freeze({berberina:24990,magnesio:14850});
export const validPrice=n=>Number.isInteger(n)&&n>=1000&&n<=1000000;
export async function readPrices(db){
 db??=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await db.from("storefront_prices").select("id,price_clp,updated_at");
 if(error){if(["42P01","PGRST205"].includes(error.code))return {prices:{...DEFAULT_PRICES},editable:false};throw new Error("No se pudieron consultar precios");}
 const prices=Object.fromEntries((data||[]).map(r=>[r.id,r.price_clp]));
 if(!Object.keys(DEFAULT_PRICES).every(id=>validPrice(prices[id])))throw new Error("Catálogo incompleto");
 return {prices,editable:true};
}
export class PriceChanged extends Error{}
export function confirmTotal(cart,expected,editable){if((editable||expected!==undefined)&&(!Number.isInteger(expected)||cart.amount!==expected))throw new PriceChanged("Los precios cambiaron. Actualiza la página y revisa el total antes de pagar.");}
