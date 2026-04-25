import{c as o,d as r,s as e}from"./index-DevGUTWX.js";/**
 * @license lucide-react v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const d=o("ArrowDownRight",[["path",{d:"m7 7 10 10",key:"1fmybs"}],["path",{d:"M17 7v10H7",key:"6fjiku"}]]);/**
 * @license lucide-react v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u=o("ArrowUpRight",[["path",{d:"M7 7h10v10",key:"1tivn9"}],["path",{d:"M7 17 17 7",key:"1vkiza"}]]),f=r(t=>({accounts:[],loading:!1,fetch:async()=>{t({loading:!0});const{data:a}=await e.from("accounts").select("*").order("created_at");t({accounts:a||[],loading:!1})},add:async a=>{const{data:{user:c}}=await e.auth.getUser();if(!c)return;const{data:s}=await e.from("accounts").insert({...a,user_id:c.id}).select().single();s&&t(n=>({accounts:[...n.accounts,s]}))},remove:async a=>{await e.from("accounts").delete().eq("id",a),t(c=>({accounts:c.accounts.filter(s=>s.id!==a)}))}}));export{u as A,d as a,f as u};
