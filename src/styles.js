export const S = {
  card:{background:"#fff",border:"2.5px solid #C8E6B0",borderRadius:18,padding:16,boxShadow:"0 4px 16px rgba(61,139,46,0.12)",marginBottom:12},
  btn:{border:"none",borderRadius:14,cursor:"pointer",fontFamily:"Nunito,sans-serif",fontWeight:800,padding:"13px 20px",fontSize:14},
  inp:{background:"#F5FBF0",border:"2px solid #C8E6B0",borderRadius:10,padding:"10px 12px",fontFamily:"Nunito,sans-serif",fontSize:13,fontWeight:700,color:"#1A3A0A",outline:"none",width:"100%",boxSizing:"border-box"},
  lbl:{fontSize:10,fontWeight:800,color:"#8AAA7A",textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:4},
};
export const GF=`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&display=swap');
.mgr-grid{display:grid;grid-template-columns:1fr;gap:10px;}
@media(min-width:600px){.mgr-grid{grid-template-columns:1fr 1fr;}}
/* Fix 3 — Responsive containers */
.resp-wide{width:100%;margin:0 auto;}
@media(min-width:640px){
  .resp-wide{max-width:760px!important;padding-left:20px!important;padding-right:20px!important;}
  /* Fix 2 — Admin tabs: wrap op desktop i.p.v. scrollen */
  .admin-tabs-bar{overflow-x:visible!important;flex-wrap:wrap!important;}
  /* Fix 1 — Modals: floating dialog op desktop */
  .modal-overlay{justify-content:center!important;padding:32px 16px!important;overflow-y:auto!important;align-items:flex-start!important;}
  .modal-box{min-height:0!important;border-radius:20px!important;box-shadow:0 28px 64px rgba(0,0,0,0.5)!important;overflow-y:auto!important;max-height:90vh!important;}
}
/* Fix 5 — Grotere labels op desktop */
@media(min-width:640px){
  .lbl-responsive{font-size:11px!important;letter-spacing:0.5px!important;}
  .text-sm-responsive{font-size:12px!important;}
}
/* Fix 6 — Admin formulieren: 3 kolommen op desktop */
@media(min-width:640px){
  .admin-grid-2{grid-template-columns:1fr 1fr!important;}
  .admin-grid-3{display:grid!important;grid-template-columns:1fr 1fr 1fr!important;gap:8px!important;}
}
/* Fix 4 — Hover effecten (desktop) */
.card-hover{transition:transform .15s ease,filter .15s ease;}
.card-hover:hover{transform:translateY(-4px);filter:brightness(1.07);}
.btn-hover{transition:opacity .12s ease,transform .12s ease;}
.btn-hover:hover{opacity:.88;transform:translateY(-1px);}
.login-card-hover{transition:box-shadow .15s ease,border-color .15s ease;}
.login-card-hover:hover{box-shadow:0 8px 28px rgba(61,139,46,0.2)!important;}
@page{size:A4;margin:0;}
@media print{
  body{visibility:hidden!important;}
  #qr-a4-print,#qr-a4-print *{visibility:visible!important;}
  #qr-a4-print{position:absolute!important;left:0!important;top:0!important;width:210mm!important;min-height:297mm!important;box-shadow:none!important;}
  .qr-no-print{display:none!important;}
}`;
