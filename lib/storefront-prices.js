import {createClient} from "@supabase/supabase-js";
export const DEFAULT_PRICES=Object.freeze({berberina:24990,magnesio:14850});
export const validPrice=n=>Number.isInteger(n)&&n>=1000&&n<=1000000;
export function validPromotions(value){return !!value&&typeof value==="object"&&!Array.isArray(value)&&Object.entries(value).every(([q,n])=>/^[1-7]$/.test(q)&&Number.isInteger(n)&&n>=1000&&n<=7000000);}
export async function readPrices(db){
 db??=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 let {data,error}=await db.from("storefront_prices").select("id,price_clp,updated_at,promotions");
 let promoEditable=true;if(["42703","PGRST204"].includes(error?.code)){({data,error}=await db.from("storefront_prices").select("id,price_clp,updated_at"));promoEditable=false;}
 if(error){if(["42P01","PGRST205"].includes(error.code))return {prices:{...DEFAULT_PRICES},editable:false,promoEditable:false,promotions:{}};throw new Error("No se pudieron consultar precios");}
 const prices=Object.fromEntries((data||[]).map(r=>[r.id,r.price_clp]));
 if(!Object.keys(DEFAULT_PRICES).every(id=>validPrice(prices[id])))throw new Error("Catálogo incompleto");
 const promotions=Object.fromEntries(data.map(r=>[r.id,validPromotions(r.promotions)?r.promotions:{}]));return {prices,editable:true,promoEditable,promotions};
}
export class PriceChanged extends Error{}
export function confirmTotal(cart,expected,editable){if((editable||expected!==undefined)&&(!Number.isInteger(expected)||cart.amount!==expected))throw new PriceChanged("Los precios cambiaron. Actualiza la página y revisa el total antes de pagar.");}
