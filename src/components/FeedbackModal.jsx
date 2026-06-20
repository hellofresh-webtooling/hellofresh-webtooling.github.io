import { useState, useEffect } from "react";
import { supabase, ls, dbSet, keyFor } from "../lib/db.js";
import { tr } from "../i18n/trans.js";
import { S } from "../styles.js";

export default function FeedbackModal({locId,lang="nl",onClose}){
  useEffect(()=>{const f=(e)=>{if(e.key==="Escape")onClose();};document.addEventListener("keydown",f);return()=>document.removeEventListener("keydown",f);},[onClose]);
  const [type,setType]=useState("probleem");
  const [name,setName]=useState("");
  const [msg,setMsg]=useState("");
  const [err,setErr]=useState(false);
  const [sending,setSending]=useState(false);
  const [done,setDone]=useState(false);
  const rtl=lang==="ar";

  const submit=async()=>{
    if(!msg.trim()){setErr(true);return;}
    setSending(true);
    const entry={id:crypto.randomUUID(),type,name:name.trim(),msg:msg.trim(),ts:Date.now(),status:"open"};
    const k=keyFor("vkast-feedback",locId);
    let cur=[];
    try{
      const {data}=await supabase.from("app_state").select("value").eq("key",k).maybeSingle();
      cur=Array.isArray(data?.value)?data.value:[];
    }catch{ cur=ls.get(k)||[]; }
    if(!Array.isArray(cur))cur=[];
    await dbSet(k,[entry,...cur].slice(0,300));
    setSending(false);setDone(true);
  };
  const reset=()=>{setType("probleem");setName("");setMsg("");setErr(false);setDone(false);};

  return(
    <div className="modal-overlay" style={{position:"fixed",inset:0,background:"rgba(196,106,18,0.5)",zIndex:500,display:"flex",flexDirection:"column",alignItems:"center",overflowY:"auto"}}>
      <div dir={rtl?"rtl":"ltr"} className="modal-box" style={{width:"100%",maxWidth:460,minHeight:"100vh",display:"flex",flexDirection:"column",background:"linear-gradient(160deg,#FFF8EF,#FEFCF4)"}}>
        <div style={{background:"#E8902A",padding:"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:18}}>📣</span><div style={{fontSize:15,fontWeight:900,color:"#fff"}}>{tr(lang,"fbTitle")}</div></div>
          <button style={{background:"rgba(255,255,255,0.15)",border:"1.5px solid rgba(255,255,255,0.3)",color:"#fff",fontSize:16,width:36,height:36,borderRadius:10,cursor:"pointer",fontWeight:700}} onClick={onClose}>×</button>
        </div>

        {done?(
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 24px",textAlign:"center"}}>
            <div style={{fontSize:54,marginBottom:12}}>✅</div>
            <div style={{fontSize:22,fontWeight:900,color:"#C46A12",marginBottom:6}}>{tr(lang,"fbThanksTitle")}</div>
            <div style={{fontSize:14,fontWeight:700,color:"#8A6A3A",marginBottom:28,maxWidth:300}}>{tr(lang,"fbThanksMsg")}</div>
            <button onClick={reset} style={{...S.btn,background:"#fff",border:"2.5px solid #F3C98B",color:"#C46A12",marginBottom:10}}>{tr(lang,"fbNew")}</button>
            <button onClick={onClose} style={{...S.btn,background:"linear-gradient(135deg,#E8902A,#C46A12)",color:"#fff"}}>{tr(lang,"close")}</button>
          </div>
        ):(
          <div style={{flex:1,padding:16}}>
            <div style={{fontSize:13,fontWeight:700,color:"#8A6A3A",lineHeight:1.5,marginBottom:16}}>{tr(lang,"fbIntro")}</div>
            <div style={{marginBottom:16}}>
              <span style={{...S.lbl,color:"#B5895A"}}>{tr(lang,"fbType")}</span>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {[["probleem","⚠️","fbProblem","fbProblemSub"],["aanpassing","💡","fbChange","fbChangeSub"]].map(([t,ic,lbl,sub])=>(
                  <button type="button" key={t} onClick={()=>setType(t)} className="card-hover"
                    style={{font:"inherit",width:"100%",textAlign:"center",padding:"14px 8px",borderRadius:14,border:`2.5px solid ${type===t?"#E8902A":"#F0DFC4"}`,background:type===t?"#FFF1DE":"#fff"}}>
                    <div style={{fontSize:24,marginBottom:4}}>{ic}</div>
                    <div style={{fontSize:13,fontWeight:900,color:type===t?"#C46A12":"#8A6A3A"}}>{tr(lang,lbl)}</div>
                    <div style={{fontSize:9,fontWeight:700,color:"#B5895A",marginTop:2}}>{tr(lang,sub)}</div>
                  </button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:16}}>
              <span style={{...S.lbl,color:"#B5895A"}}>{tr(lang,"fbName")}</span>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder={tr(lang,"fbNamePlaceholder")}
                style={{...S.inp,background:"#FFFDF8",border:"2px solid #F0DFC4",textAlign:rtl?"right":"left"}}/>
            </div>
            <div style={{marginBottom:8}}>
              <span style={{...S.lbl,color:"#B5895A"}}>{tr(lang,"fbMessage")} *</span>
              <textarea value={msg} onChange={e=>{setMsg(e.target.value);if(err)setErr(false);}} placeholder={tr(lang,"fbMessagePlaceholder")}
                style={{...S.inp,background:"#FFFDF8",border:`2px solid ${err?"#e74c3c":"#F0DFC4"}`,height:120,resize:"vertical",lineHeight:1.5,textAlign:rtl?"right":"left"}}/>
            </div>
            {err&&<div style={{color:"#e74c3c",fontSize:12,fontWeight:700,marginBottom:10}}>{tr(lang,"fbRequired")}</div>}
            <button onClick={submit} disabled={sending}
              style={{...S.btn,width:"100%",marginTop:8,background:sending?"#E8C49A":"linear-gradient(135deg,#E8902A,#C46A12)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",gap:8,cursor:sending?"wait":"pointer"}}>
              <span style={{fontSize:18}}>📨</span> {sending?tr(lang,"fbSending"):tr(lang,"fbSend")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
