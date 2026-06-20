import { useState, useRef } from "react";
import { tr, dloc } from "../i18n/trans.js";
import { S } from "../styles.js";
import { ConfirmModal } from "./shared.jsx";

const SDS_KINDS=[
  {id:"vib",   icon:"⚠️", key:"sdsKindVib"},
  {id:"tech",  icon:"🔧", key:"sdsKindTech"},
  {id:"manual",icon:"📘", key:"sdsKindManual"},
  {id:"other", icon:"📎", key:"sdsKindOther"},
];
const sdsKindOf=(id)=>SDS_KINDS.find(k=>k.id===id)||SDS_KINDS[0];

export default function SdsControl({product,locId,meta,canEdit=false,lang="nl",uploadedBy="",onSaved,onRemoved}){
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState("");
  const [confirm,setConfirm]=useState(null);
  const [kind,setKind]=useState("vib");
  const fileRef=useRef(null);
  const rtl=lang==="ar";
  const docs=Array.isArray(meta)?meta:(meta?[meta]:[]);
  const has=docs.length>0;

  const onFile=async(e)=>{
    const file=e.target.files?.[0];
    if(e.target)e.target.value="";
    if(!file)return;
    if(file.type!=="application/pdf"){setErr(tr(lang,"sdsBadType"));return;}
    if(file.size>10*1024*1024){setErr(tr(lang,"sdsTooBig"));return;}
    setErr("");setBusy(true);
    try{
      const ext=(file.name.split(".").pop()||"pdf").toLowerCase();
      const path=`${locId}/${product.id}-${Date.now()}.${ext}`;
      const fd=new FormData();
      fd.append("file",file);
      fd.append("path",path);
      const res=await fetch(import.meta.env.VITE_EDGE_URL,{
        method:"POST",
        headers:{"x-app-secret":import.meta.env.VITE_EDGE_SECRET,"x-action":"storage-upload"},
        body:fd,
      });
      if(!res.ok)throw new Error(await res.text());
      const {url}=await res.json();
      onSaved?.(product.id,{fileName:file.name,path,url,size:file.size,type:file.type,kind,uploadedAt:new Date().toISOString(),uploadedBy,productName:product.name});
    }catch{ setErr(tr(lang,"sdsError")); }
    setBusy(false);
  };

  const remove=(doc)=>{
    setConfirm({msg:tr(lang,"sdsRemoveConfirm"),fn:async()=>{
      if(doc?.path){
        await fetch(import.meta.env.VITE_EDGE_URL,{
          method:"POST",
          headers:{"Content-Type":"application/json","x-app-secret":import.meta.env.VITE_EDGE_SECRET,"x-action":"storage-delete"},
          body:JSON.stringify({path:doc.path}),
        }).catch(()=>{});
      }
      onRemoved?.(product.id,doc,product.name);
    }});
  };

  return(<>
    {confirm&&<ConfirmModal msg={confirm.msg} onConfirm={()=>{confirm.fn();setConfirm(null);}} onCancel={()=>setConfirm(null)}/>}
    <button title={tr(lang,"sds")} aria-label={tr(lang,"sds")} onClick={()=>setOpen(true)}
      style={{flexShrink:0,display:"inline-flex",alignItems:"center",gap:3,background:has?"#EEF9E6":"#F3F3F3",border:`1.5px solid ${has?"#3D8B2E":"#D6D6D6"}`,borderRadius:8,padding:"6px 10px",cursor:"pointer",fontFamily:"Nunito,sans-serif",fontSize:10,fontWeight:800,color:has?"#3D8B2E":"#9A9A9A",lineHeight:1}}>
      <span style={{fontSize:12}}>📄</span>{tr(lang,"sds")}{has&&<span style={{background:"#3D8B2E",color:"#fff",borderRadius:8,padding:"0 5px",fontSize:9}}>{docs.length}</span>}
    </button>
    {open&&(
      <div className="modal-overlay" style={{position:"fixed",inset:0,background:"rgba(61,139,46,0.45)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={()=>!busy&&setOpen(false)}>
        <div dir={rtl?"rtl":"ltr"} onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:440,maxHeight:"90vh",display:"flex",flexDirection:"column",background:"linear-gradient(160deg,#F7FCF2,#FEFEFB)",borderRadius:18,overflow:"hidden",boxShadow:"0 12px 40px rgba(0,0,0,0.25)"}}>
          <div style={{background:"#3D8B2E",padding:"13px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}><span style={{fontSize:18}}>📄</span><div style={{minWidth:0}}>
              <div style={{fontSize:14,fontWeight:900,color:"#fff"}}>{tr(lang,"sdsTitle")}</div>
              <div style={{fontSize:11,fontWeight:700,color:"#D6F0C8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{product.name}</div>
            </div></div>
            <button aria-label={tr(lang,"close")} onClick={()=>!busy&&setOpen(false)} style={{background:"rgba(255,255,255,0.15)",border:"1.5px solid rgba(255,255,255,0.3)",color:"#fff",fontSize:16,width:44,height:44,borderRadius:9,cursor:"pointer",fontWeight:700,flexShrink:0}}>×</button>
          </div>
          <div style={{padding:16,overflowY:"auto"}}>
            {has?(
              <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
                {docs.map((doc,i)=>{
                  const dt=doc.uploadedAt?new Date(doc.uploadedAt).toLocaleDateString(dloc(lang)):"";
                  const dk=sdsKindOf(doc.kind);
                  return(
                    <div key={doc.path||i} style={{border:"2px solid #DCEFCF",borderRadius:12,padding:"10px 12px",background:"#fff"}}>
                      <span style={{display:"inline-flex",alignItems:"center",gap:4,background:"#EEF9E6",border:"1.5px solid #3D8B2E55",borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:800,color:"#3D8B2E",marginBottom:6}}>{dk.icon} {tr(lang,dk.key)}</span>
                      <div style={{fontSize:13,fontWeight:800,color:"#1A3A0A",wordBreak:"break-all",marginBottom:4}}>{doc.fileName}</div>
                      {(doc.uploadedBy||dt)&&<div style={{fontSize:11,fontWeight:700,color:"#8AAA7A",marginBottom:8}}>{tr(lang,"sdsUploadedBy")} {doc.uploadedBy||"—"}{dt&&` ${tr(lang,"sdsUploadedOn")} ${dt}`}</div>}
                      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                        <a href={doc.url} target="_blank" rel="noreferrer" style={{...S.btn,flex:1,minWidth:120,textAlign:"center",textDecoration:"none",background:"linear-gradient(135deg,#4DA035,#3D8B2E)",color:"#fff",padding:"9px 10px",fontSize:13}}>👁 {tr(lang,"sdsView")}</a>
                        <a href={doc.url} download={doc.fileName} style={{...S.btn,flex:1,minWidth:120,textAlign:"center",textDecoration:"none",background:"#F5FBF0",border:"2px solid #C8E6B0",color:"#3D8B2E",padding:"9px 10px",fontSize:13}}>⬇ {tr(lang,"sdsDownload")}</a>
                        {canEdit&&<button aria-label={tr(lang,"sdsRemove")} onClick={()=>remove(doc)} disabled={busy} style={{background:"#fff",border:"2px solid #E8C0C0",color:"#C0392B",borderRadius:12,padding:"9px 12px",cursor:busy?"wait":"pointer",fontSize:13,fontWeight:800,minWidth:44,minHeight:44}}>🗑</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ):(
              <div style={{fontSize:13,fontWeight:700,color:"#8AAA7A",textAlign:"center",padding:"14px 0 18px"}}>{tr(lang,"sdsNone")}</div>
            )}
            {canEdit&&(<div style={{borderTop:has?"1px solid #DCEFCF":"none",paddingTop:has?14:0}}>
              <input ref={fileRef} type="file" accept="application/pdf" style={{display:"none"}} onChange={onFile}/>
              <span style={{...S.lbl,marginBottom:6}}>{tr(lang,"sdsKind")}</span>
              <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
                {SDS_KINDS.map(k=>{
                  const active=kind===k.id;
                  return(
                    <button key={k.id} onClick={()=>setKind(k.id)} disabled={busy}
                      style={{display:"inline-flex",alignItems:"center",gap:4,background:active?"#EEF9E6":"#fff",border:`2px solid ${active?"#3D8B2E":"#C8E6B0"}`,borderRadius:20,padding:"5px 11px",cursor:busy?"wait":"pointer",fontFamily:"Nunito,sans-serif",fontSize:11,fontWeight:800,color:active?"#3D8B2E":"#8AAA7A"}}>
                      {k.icon} {tr(lang,k.key)}
                    </button>
                  );
                })}
              </div>
              {err&&<div style={{color:"#e74c3c",fontSize:12,fontWeight:700,marginBottom:8,textAlign:"center"}}>{err}</div>}
              <button onClick={()=>fileRef.current?.click()} disabled={busy}
                style={{...S.btn,width:"100%",background:busy?"#B8D9A8":"linear-gradient(135deg,#4DA035,#3D8B2E)",color:"#fff",cursor:busy?"wait":"pointer"}}>
                {busy?tr(lang,"sdsUploading"):`⬆ ${tr(lang,"sdsAdd")}`}
              </button>
            </div>)}
          </div>
        </div>
      </div>
    )}
  </>);
}
