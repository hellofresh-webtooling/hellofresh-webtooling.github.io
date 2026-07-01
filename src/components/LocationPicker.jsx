import { GF } from "../styles.js";
import { LOCATIONS, COUNTRIES } from "../lib/db.js";
import { HelloFreshLogo, Hdr, Ftr } from "./shared.jsx";

// Inline SVG-vlaggen: renderen overal (ook Windows, waar emoji-vlaggen niet werken)
function FlagIcon({code}){
  const common={width:24,height:16,rx:2.5,style:{display:"block",boxShadow:"0 0 0 1px rgba(0,0,0,0.08)",borderRadius:2.5}};
  if(code==="NL"){
    return(
      <svg viewBox="0 0 24 16" {...common}>
        <rect width="24" height="16" fill="#21468B"/>
        <rect width="24" height="10.67" fill="#fff"/>
        <rect width="24" height="5.33" fill="#AE1C28"/>
      </svg>
    );
  }
  if(code==="BE"){
    return(
      <svg viewBox="0 0 24 16" {...common}>
        <rect width="24" height="16" fill="#EF3340"/>
        <rect width="16" height="16" fill="#FDDA24"/>
        <rect width="8" height="16" fill="#000"/>
      </svg>
    );
  }
  return null;
}

export default function LocationPicker({onPick,onHQ}){
  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#F0FAE8,#FEFCF4)",fontFamily:"Nunito,Arial,sans-serif",display:"flex",flexDirection:"column",alignItems:"center"}}>
      <style>{GF}</style>
      <Hdr cfg={{appName:"Voorraadbeheer",location:"Kies je locatie"}}/>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",padding:"28px 18px 12px",width:"100%",maxWidth:560}}>
        <div style={{marginBottom:14}}><HelloFreshLogo size={96}/></div>
        <div style={{fontSize:26,fontWeight:900,color:"#3D8B2E",marginBottom:2}}>Voorraadbeheer</div>
        <div style={{fontSize:11,color:"#8AAA7A",letterSpacing:2,textTransform:"uppercase",marginBottom:24,fontWeight:700}}>Kies een vestiging</div>

        {COUNTRIES.map(c=>{
          const locs=LOCATIONS.filter(l=>l.country===c.code);
          if(locs.length===0)return null;
          return(
            <div key={c.code} style={{width:"100%",marginBottom:22}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <FlagIcon code={c.code}/>
                <span style={{fontSize:12,fontWeight:800,color:"#4A6A3A",textTransform:"uppercase",letterSpacing:1}}>{c.label}</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10}}>
                {locs.map(l=>(
                  <button type="button" key={l.id} className="card-hover" onClick={()=>onPick(l.id)}
                    style={{font:"inherit",width:"100%",background:"#fff",border:"2.5px solid #C8E6B0",borderRadius:16,padding:"16px 12px",textAlign:"center",boxShadow:"0 4px 14px rgba(61,139,46,0.1)"}}>
                    <div style={{fontSize:22,marginBottom:6}}>📍</div>
                    <div style={{fontSize:14,fontWeight:900,color:"#1A3A0A",lineHeight:1.2}}>{l.name}</div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        <button className="btn-hover" onClick={onHQ}
          style={{marginTop:6,marginBottom:20,display:"flex",alignItems:"center",gap:10,background:"linear-gradient(135deg,#1E3A5F,#0F2A47)",border:"none",borderRadius:16,padding:"14px 26px",fontFamily:"Nunito,Arial,sans-serif",fontSize:14,fontWeight:800,color:"#fff",cursor:"pointer",boxShadow:"0 6px 20px rgba(15,42,71,0.3)"}}>
          <span style={{fontSize:20}}>🏢</span>
          <div style={{textAlign:"left"}}><div>HQ-overzicht</div><div style={{fontSize:9,opacity:0.7,fontWeight:700}}>Alle locaties · PIN vereist</div></div>
        </button>
      </div>
      <Ftr/>
    </div>
  );
}
