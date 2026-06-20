import { useState, useEffect, useRef } from "react";
import { tr } from "../i18n/trans.js";
import { GF } from "../styles.js";

export function useFocusTrap(ref) {
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const sel = 'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const focusable = () => [...el.querySelectorAll(sel)];
    focusable()[0]?.focus();
    const onKey = (e) => {
      if (e.key !== "Tab") return;
      const els = focusable();
      if (!els.length) return;
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, []);
}

export function ConfirmModal({msg,onConfirm,onCancel}){
  const ref = useRef(null);
  useFocusTrap(ref);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:24}} onClick={e=>{if(e.target===e.currentTarget)onCancel();}}>
      <div ref={ref} role="dialog" aria-modal="true" style={{background:"#fff",borderRadius:18,padding:28,maxWidth:320,width:"100%",textAlign:"center",boxShadow:"0 8px 32px rgba(0,0,0,0.3)"}}>
        <div style={{fontSize:14,fontWeight:700,color:"#1A3A0A",marginBottom:24,lineHeight:1.5}}>{msg}</div>
        <div style={{display:"flex",gap:10,justifyContent:"center"}}>
          <button type="button" style={{padding:"11px 22px",background:"#FDEDEA",border:"2px solid #D44A2A",borderRadius:12,color:"#D44A2A",fontFamily:"Nunito,sans-serif",fontSize:13,fontWeight:800,cursor:"pointer"}} onClick={onConfirm}>Ja</button>
          <button type="button" style={{padding:"11px 22px",background:"#F5FBF0",border:"2px solid #C8E6B0",borderRadius:12,color:"#3D8B2E",fontFamily:"Nunito,sans-serif",fontSize:13,fontWeight:800,cursor:"pointer"}} onClick={onCancel}>Annuleer</button>
        </div>
      </div>
    </div>
  );
}

export function HelloFreshLogo({size=32}){
  return(
    <img src={`${import.meta.env.BASE_URL}hellofresh-logo.svg`} height={size} width={size*1.5} style={{display:"inline-block",flexShrink:0,objectFit:"contain"}} alt="HelloFresh"/>
  );
}

export function PinPad({pin,onDigit,onDel,locked,err,errMsg,lockedMsg,theme="admin"}){
  const T=theme==="hq"
    ?{bg:"#16324E",border:"#1A3A5A",dot:"#2E6FA8",dotEmpty:"#1A3A5A",btn:"#A8D0F0",btnLocked:"#1A3A5A",del:"#7BA8CC"}
    :{bg:"#16213E",border:"#3D2A7A",dot:"#7C5CBF",dotEmpty:"#3D2A7A",btn:"#C0B0E8",btnLocked:"#3D2A7A",del:"#9B8EC4"};
  return(
    <>
      <div style={{display:"flex",justifyContent:"center",gap:12,marginBottom:20}}>
        {[0,1,2,3].map(i=><div key={i} style={{width:16,height:16,borderRadius:"50%",border:`2.5px solid ${pin.length>i?T.dot:T.dotEmpty}`,background:pin.length>i?T.dot:"transparent"}}/>)}
      </div>
      {err&&<div style={{color:"#e74c3c",fontSize:12,fontWeight:700,marginBottom:10}}>{errMsg}</div>}
      {locked&&<div style={{color:"#e74c3c",fontSize:12,fontWeight:700,marginBottom:10}}>{lockedMsg}</div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
        {[1,2,3,4,5,6,7,8,9].map(n=>(
          <button key={n} type="button"
            style={{height:52,background:T.bg,border:`2px solid ${T.border}`,borderRadius:12,color:locked?T.btnLocked:T.btn,fontFamily:"Nunito,sans-serif",fontSize:20,fontWeight:700,cursor:locked?"not-allowed":"pointer"}}
            onClick={()=>onDigit(String(n))}>{n}</button>
        ))}
        <div/>
        <button type="button"
          style={{height:52,background:T.bg,border:`2px solid ${T.border}`,borderRadius:12,color:locked?T.btnLocked:T.btn,fontFamily:"Nunito,sans-serif",fontSize:20,fontWeight:700,cursor:locked?"not-allowed":"pointer"}}
          onClick={()=>onDigit("0")}>0</button>
        <button type="button"
          style={{height:52,background:T.bg,border:`2px solid ${T.border}`,borderRadius:12,color:T.del,fontFamily:"Nunito,sans-serif",fontSize:16,cursor:"pointer"}}
          onClick={onDel}>DEL</button>
      </div>
    </>
  );
}

export function Hdr({cfg,role,isAdmin,onBack,backLabel,onSwitch,userName,lang="nl",offline=false}){
  const roleLabel = role==="admin"?tr(lang,"admin"):role==="manager"?tr(lang,"manager"):tr(lang,"worker");
  return(
    <>
      <div style={{width:"100%",background:isAdmin?"#0D0D1A":"#3D8B2E",padding:"11px 14px",display:"flex",alignItems:"center",gap:10,position:"sticky",top:0,zIndex:200,boxShadow:"0 3px 14px rgba(61,139,46,0.25)",overflowX:"auto",scrollbarWidth:"none"}}>
        <span style={{flexShrink:0}}>{isAdmin?"🔧":<HelloFreshLogo size={36}/>}</span>
        <div style={{flexShrink:0}}>
          <div style={{fontSize:15,fontWeight:900,color:"#fff",whiteSpace:"nowrap"}}>{isAdmin?"Masterfile":cfg?.appName||"Voorraadbeheer"}</div>
          <div style={{fontSize:9,color:"rgba(255,255,255,0.6)",whiteSpace:"nowrap"}}>{cfg?.location||""}</div>
        </div>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
          {userName&&<div style={{fontSize:10,fontWeight:800,color:"#fff",whiteSpace:"nowrap",maxWidth:100,overflow:"hidden",textOverflow:"ellipsis"}}>{userName}</div>}
          {role&&<div style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.85)",padding:"4px 8px",border:"1.5px solid rgba(255,255,255,0.3)",borderRadius:20,background:"rgba(255,255,255,0.12)",textTransform:"uppercase",whiteSpace:"nowrap"}}>{roleLabel}</div>}
          {onBack&&<button style={{background:"rgba(255,255,255,0.15)",border:"1.5px solid rgba(255,255,255,0.3)",color:"#fff",fontFamily:"Nunito,Arial,sans-serif",fontSize:11,fontWeight:700,padding:"5px 11px",borderRadius:20,cursor:"pointer",whiteSpace:"nowrap"}} onClick={onBack}>{backLabel||tr(lang,"back")}</button>}
          {!onBack&&role&&onSwitch&&<button style={{background:"rgba(255,255,255,0.15)",border:"1.5px solid rgba(255,255,255,0.3)",color:"#fff",fontFamily:"Nunito,Arial,sans-serif",fontSize:11,fontWeight:700,padding:"5px 11px",borderRadius:20,cursor:"pointer",whiteSpace:"nowrap"}} onClick={onSwitch}>{tr(lang,"logout")}</button>}
        </div>
      </div>
      {offline&&<div role="status" style={{width:"100%",background:"#FFF3CD",borderBottom:"2px solid #FFC107",padding:"7px 16px",textAlign:"center",fontSize:12,fontWeight:700,color:"#856404"}}>{tr(lang,"offlineMsg")}</div>}
    </>
  );
}

export function Ftr({isAdmin}){
  return(
    <div style={{width:"100%",padding:"13px 20px 16px",marginTop:28,borderTop:`2px solid ${isAdmin?"#3D2A7A":"#C8E6B0"}`,background:isAdmin?"#16213E":"linear-gradient(180deg,#F5FBF0,#fff)",textAlign:"center"}}>
      <div style={{fontSize:11,fontWeight:600,color:isAdmin?"#5A4A7A":"#8AAA7A",lineHeight:1.6}}>2026 HelloFresh — Alle rechten voorbehouden.</div>
    </div>
  );
}
