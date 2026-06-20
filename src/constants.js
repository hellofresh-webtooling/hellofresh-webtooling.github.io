import { locName } from "./lib/db.js";

export const DEF = {
  appName: "Voorraadbeheer", location: "Ruinerwold",
  adminPin: "9999", checkAlertDays: 14, shelfAlertPct: 80,
  features: { consumptionTracking: true, emailReports: true, partialBottles: true },
  accounts: [
    { id:1, username:"Medewerker 1", password:"123456", role:"worker",  active:true },
    { id:2, username:"Manager",      password:"654321", role:"manager", active:true },
  ],
  emails: [
    { id:1, dept:"Inkoop",     email:"inkoop@bedrijf.nl",     active:true },
    { id:2, dept:"Facilitair", email:"facilitair@bedrijf.nl", active:true },
  ],
  shelves: [
    { id:1, label:"Lekbak 1", sublabel:"Bovenste lekbak",  maxLiters:30, color:"#3D8B2E", category:"flammable", active:true, products:[
      {id:"1-1",name:"Glasreiniger",vol:0.75,target:5},{id:"1-2",name:"Ontvetter spray",vol:1.0,target:4},
      {id:"1-3",name:"Desinfectie middel",vol:1.0,target:4},{id:"1-4",name:"Badkamerreiniger",vol:2.0,target:3},{id:"1-5",name:"RVS reiniger",vol:0.5,target:5},
    ]},
    { id:2, label:"Lekbak 2", sublabel:"Middelste lekbak", maxLiters:30, color:"#5AAE3C", category:"flammable", active:true, products:[
      {id:"2-1",name:"Allesreiniger",vol:5.0,target:2},{id:"2-2",name:"Vloeibare zeep",vol:2.0,target:3},
      {id:"2-3",name:"Handzeep",vol:1.0,target:3},{id:"2-4",name:"Schuurmiddel",vol:1.0,target:3},{id:"2-5",name:"Sanitairreiniger",vol:2.0,target:2},
    ]},
    { id:3, label:"Lekbak 3", sublabel:"Derde lekbak",    maxLiters:26, color:"#78C74E", category:"corrosive", active:true, products:[
      {id:"3-1",name:"Green'r Indus",vol:5.0,target:1},{id:"3-2",name:"Green'r Hand dish",vol:1.0,target:4},
      {id:"3-3",name:"Green'r Wind",vol:0.75,target:8},{id:"3-4",name:"Green'r Easy All",vol:0.75,target:3},
      {id:"3-5",name:"Green'r Sanit",vol:0.75,target:2},{id:"3-6",name:"Green'r WC",vol:0.75,target:3},{id:"3-7",name:"Phago'derm Sensitive",vol:5.0,target:1},
    ]},
    { id:4, label:"Lekbak 4", sublabel:"Onderste lekbak", maxLiters:33, color:"#A8DE52", category:"corrosive", active:true, products:[
      {id:"4-1",name:"Keukenreiniger",vol:1.0,target:4},{id:"4-2",name:"Vetoplosser",vol:2.0,target:3},
      {id:"4-3",name:"Roestvrijstaal spray",vol:0.5,target:5},{id:"4-4",name:"Ontkalker",vol:1.0,target:3},{id:"4-5",name:"Multireiniger",vol:5.0,target:2},
    ]},
  ],
  voorraad: [
    { id:"v-1", name:"WC papier",           unit:"rol",  target:48, active:true },
    { id:"v-2", name:"Handdoekrollen",      unit:"rol",  target:20, active:true },
    { id:"v-3", name:"Latex handschoenen",  unit:"doos", target:10, active:true },
    { id:"v-4", name:"Haarnetjes",          unit:"doos", target:5,  active:true },
    { id:"v-5", name:"Baardnetjes",         unit:"doos", target:5,  active:true },
  ],
};

export const defCfgFor = (locId) => { const c=JSON.parse(JSON.stringify(DEF)); c.location=locName(locId); return c; };

export const CAT = {
  flammable:{label:"Ontvlambaar",icon:"🔥",ghs:"GHS02",color:"#E8632A",bg:"#FDF0EB"},
  corrosive:{label:"Corrosief",icon:"⚗️",ghs:"GHS05",color:"#7C3A9A",bg:"#F5EEFF"},
};

export const aSh  = (cfg) => cfg.shelves.filter(s=>s.active);
export const aPr  = (sh)  => sh.products;
export const defI = (cfg) => {
  const i={};
  cfg.shelves.forEach(s=>s.products.forEach(p=>{i[p.id]={full:0,partial:0};}));
  (cfg.voorraad||[]).forEach(p=>{i[p.id]={count:0};});
  return i;
};
export const pL   = (p,inv) => { const s=inv[p.id]||{full:0,partial:0}; return s.full*p.vol+(s.partial>0?p.vol*s.partial/100:0); };
export const shL  = (sh,inv) => aPr(sh).reduce((s,p)=>s+pL(p,inv),0);
export const shP  = (sh,inv) => Math.min((shL(sh,inv)/sh.maxLiters)*100,100);
export const fCol = (pct) => pct>=90?"#D44A2A":pct>=70?"#E8A020":pct>=30?"#3D8B2E":"#5AB8E8";
export const uCol = (n,t) => n===0?"#3D8B2E":n/t>=1?"#D44A2A":n/t>=0.5?"#E8A020":"#F5C842";

export const orderSummary = (cfg,inv) => {
  const shelves=aSh(cfg);
  const vProducts=(cfg.voorraad||[]).filter(p=>p.active!==false);
  let order=0, low=0; const items=[];
  shelves.forEach(sh=>aPr(sh).forEach(p=>{
    const need=Math.max(0,p.target-(inv[p.id]||{full:0}).full);
    order+=need; if(need>0){low++; items.push({group:sh.label,name:p.name,need,unit:"fl"});}
  }));
  vProducts.forEach(p=>{
    const need=Math.max(0,p.target-(inv[p.id]||{count:0}).count);
    order+=need; if(need>0){low++; items.push({group:"Normale Voorraad",name:p.name,need,unit:p.unit});}
  });
  return {order,low,items,shelfCount:shelves.length};
};
