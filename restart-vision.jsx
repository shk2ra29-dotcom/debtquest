import { useState, useEffect } from "react";
import {
  ComposedChart, AreaChart, Area, Line, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  BarChart, Legend
} from "recharts";

const STORAGE_KEY = "debt_dashboard_v2";
const TODAY_MONTH = "2026/4";

// シミュレーションデータ（CSV より）
const SIM = [
  {m:"2024/4",d:5934363},{m:"2024/5",d:5679943},{m:"2024/6",d:4991707},
  {m:"2024/7",d:4938147},{m:"2024/8",d:5030999},{m:"2024/9",d:4997295},
  {m:"2024/10",d:4963455},{m:"2024/11",d:4909346},{m:"2024/12",d:4958569},
  {m:"2025/1",d:4902265},{m:"2025/2",d:4805823},{m:"2025/3",d:4677243},
  {m:"2025/4",d:5575360},{m:"2025/5",d:5392422},{m:"2025/6",d:5514665},
  {m:"2025/7",d:5739499},{m:"2025/8",d:5418083},{m:"2025/9",d:5263081},
  {m:"2025/10",d:5244598},{m:"2025/11",d:5146590},{m:"2025/12",d:5096013},
  {m:"2026/1",d:5331897},{m:"2026/2",d:5280917},{m:"2026/3",d:5361395},
  {m:"2026/4",d:5321811},{m:"2026/5",d:5282627},{m:"2026/6",d:5243302},
  {m:"2026/7",d:5203840},{m:"2026/8",d:5164239},{m:"2026/9",d:4379498},
  {m:"2026/10",d:4357271},{m:"2026/11",d:4332249},{m:"2026/12",d:4307085},
  {m:"2027/1",d:3331779},{m:"2027/2",d:3306330},{m:"2027/3",d:3275321},
  {m:"2027/4",d:2762836},{m:"2027/5",d:2731328},{m:"2027/6",d:2697076},
  {m:"2027/7",d:2662645},{m:"2027/8",d:2178018},{m:"2027/9",d:2143195},
  {m:"2027/10",d:2105610},{m:"2027/11",d:2067826},{m:"2027/12",d:1579828},
  {m:"2028/1",d:1541615},{m:"2028/2",d:1500620},{m:"2028/3",d:1459407},
  {m:"2028/4",d:967960},{m:"2028/5",d:926279},{m:"2028/6",d:881796},
  {m:"2028/7",d:837076},{m:"2028/8",d:342102},{m:"2028/9",d:296874},
  {m:"2028/10",d:248824},{m:"2028/11",d:200516},{m:"2028/12",d:151934},
  {m:"2029/1",d:103077},{m:"2029/2",d:53943},{m:"2029/3",d:4531},
  {m:"2029/4",d:0},
];

// 月ラベルの表示間引き（6ヶ月ごと）
const SHOW_LABELS = new Set(SIM.filter((_,i)=>i%6===0||i===SIM.length-1).map(s=>s.m));

// 万円表示
const oku = v => v >= 10000000 ? `${(v/10000000).toFixed(1)}億` : `${Math.round(v/10000)}万`;

function getMonthKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${d.getMonth()+1}`;
}

function calcActualByMonth(entries, initialTotal) {
  // 月ごとの返済累計を計算
  const repayByMonth = {};
  entries.filter(e=>e.type==="repay").forEach(e=>{
    const mk = getMonthKey(e.date);
    repayByMonth[mk] = (repayByMonth[mk]||0) + e.amount;
  });
  // SIMの各月に対して実績残高を計算
  const result = {};
  let cumRepay = 0;
  SIM.forEach(({m})=>{
    if (repayByMonth[m]) cumRepay += repayByMonth[m];
    result[m] = Math.max(0, initialTotal - cumRepay);
  });
  return result;
}

function calcInvestByMonth(entries) {
  const byMonth = {};
  entries.filter(e=>e.type==="invest").forEach(e=>{
    const mk = getMonthKey(e.date);
    byMonth[mk] = (byMonth[mk]||0) + e.amount;
  });
  let cum = 0;
  return SIM.map(({m})=>{
    cum += (byMonth[m]||0);
    return {m, monthly: byMonth[m]||0, cumulative: cum};
  });
}

const CustomTooltip = ({active,payload,label}) => {
  if (!active||!payload?.length) return null;
  const milestones = {"2026/9":"🎉楽天完済","2027/1":"💪残高3M切","2028/8":"残100万切","2029/4":"🏆全完済"};
  return (
    <div style={{background:"#1A1A24",border:"1px solid #2D2D3D",borderRadius:10,padding:"10px 14px",minWidth:160}}>
      <div style={{color:"#9CA3AF",fontSize:11,marginBottom:6,fontWeight:700}}>{label}{milestones[label]?` ${milestones[label]}`:""}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{color:p.color||p.fill,fontSize:13,fontWeight:700,lineHeight:1.6}}>
          {p.name}：¥{(p.value||0).toLocaleString()}
        </div>
      ))}
    </div>
  );
};

export default function RestartVision() {
  const [entries, setEntries] = useState([]);
  const [balances, setBalances] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeChart, setActiveChart] = useState("debt");

  useEffect(()=>{
    (async()=>{
      try {
        const res = await window.storage.get(STORAGE_KEY);
        if (res?.value) {
          const data = JSON.parse(res.value);
          if (data.entries) setEntries(data.entries);
          if (data.balances) setBalances(data.balances);
        }
      } catch {}
      setLoading(false);
    })();
  },[]);

  const initialTotal = Object.values(balances).reduce((s,v)=>s+(parseInt(v)||0),0) || 5934363;
  const totalRepaid = entries.filter(e=>e.type==="repay").reduce((s,e)=>s+e.amount,0);
  const totalInvest = entries.filter(e=>e.type==="invest").reduce((s,e)=>s+e.amount,0);
  const actualNow = Math.max(0, initialTotal - totalRepaid);

  const todayIdx = SIM.findIndex(s=>s.m===TODAY_MONTH);
  const simNow = SIM[todayIdx]?.d ?? 5321811;
  const diff = actualNow - simNow;

  // 実績残高マップ
  const actualMap = calcActualByMonth(entries, initialTotal);
  const investData = calcInvestByMonth(entries);

  // チャートデータ合成
  const debtChartData = SIM.map((s,i)=>({
    m: s.m,
    sim: s.d,
    actual: i <= todayIdx ? actualMap[s.m] : undefined,
    isToday: s.m === TODAY_MONTH,
  }));

  const investChartData = investData.map((d,i)=>({
    m: d.m,
    monthly: d.monthly,
    cumulative: d.cumulative,
    display: i <= todayIdx,
  })).filter(d=>d.display&&(d.monthly>0||d.cumulative>0));

  if (loading) return <div style={{color:"#fff",textAlign:"center",paddingTop:80,background:"#0A0A0F",minHeight:"100vh"}}/>;

  return (
    <div style={{minHeight:"100vh",background:"#0A0A0F",fontFamily:"'Courier New',monospace",color:"#E5E7EB",maxWidth:520,margin:"0 auto",paddingBottom:40}}>
      {/* Header */}
      <div style={{padding:"22px 20px 0",textAlign:"center"}}>
        <div style={{fontSize:10,letterSpacing:"0.3em",color:"#6B7280"}}>Re:Start Life</div>
        <div style={{fontSize:22,fontWeight:900,background:"linear-gradient(135deg,#FF6B35,#00D4AA)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",letterSpacing:"-0.02em"}}>
          VISION 2029
        </div>
        <div style={{fontSize:11,color:"#6B7280",marginTop:2}}>完済ロードマップ</div>
      </div>

      {/* Stats */}
      <div style={{padding:"16px 16px 0",display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <div style={{background:"#13131A",border:"1px solid #1F2937",borderRadius:12,padding:"14px",gridColumn:"1/-1"}}>
          <div style={{fontSize:10,color:"#6B7280",letterSpacing:"0.15em",marginBottom:4}}>現在の実績残高</div>
          <div style={{fontSize:36,fontWeight:900,color:"#FF6B35",letterSpacing:"-0.03em"}}>
            ¥{actualNow.toLocaleString()}
          </div>
          <div style={{fontSize:11,color: diff<=0?"#00D4AA":"#FF6B35",marginTop:4}}>
            {diff<=0 ? `▼ シミュより ¥${Math.abs(diff).toLocaleString()} 優位` : `▲ シミュより ¥${diff.toLocaleString()} 遅れ`}
          </div>
          {/* Progress bar to completion */}
          <div style={{marginTop:12,background:"#0A0A0F",borderRadius:99,height:8,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${Math.min(100,((initialTotal-actualNow)/initialTotal)*100).toFixed(1)}%`,background:"linear-gradient(90deg,#FF6B35,#FFD700)",borderRadius:99,transition:"width 0.6s"}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#6B7280",marginTop:4}}>
            <span>返済済 ¥{totalRepaid.toLocaleString()}</span>
            <span>完済まで ¥{actualNow.toLocaleString()}</span>
          </div>
        </div>

        {[
          {label:"シミュ予測（今月）",val:`¥${simNow.toLocaleString()}`,color:"#6B7280"},
          {label:"累計積立",val:`¥${totalInvest.toLocaleString()}`,color:"#00D4AA"},
        ].map((s,i)=>(
          <div key={i} style={{background:"#13131A",border:"1px solid #1F2937",borderRadius:12,padding:"12px"}}>
            <div style={{fontSize:10,color:"#6B7280",marginBottom:4,letterSpacing:"0.1em"}}>{s.label}</div>
            <div style={{fontSize:16,fontWeight:800,color:s.color}}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Milestones */}
      <div style={{padding:"12px 16px 0"}}>
        <div style={{background:"#13131A",border:"1px solid #1F2937",borderRadius:12,padding:"12px 16px"}}>
          <div style={{fontSize:10,color:"#6B7280",letterSpacing:"0.2em",marginBottom:10}}>MILESTONES</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {[
              {date:"2026/9",label:"🎉 楽天リボ完済",done:false,color:"#A78BFA"},
              {date:"2029/4",label:"🏆 三井住友CL完済（全完済）",done:false,color:"#FFD700"},
            ].map(ms=>{
              const idx = SIM.findIndex(s=>s.m===ms.date);
              const monthsLeft = idx - todayIdx;
              return (
                <div key={ms.date} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{fontSize:12,color:ms.color,fontWeight:700}}>{ms.label}</div>
                  <div style={{fontSize:11,color:"#6B7280"}}>
                    {ms.date}（あと{monthsLeft}ヶ月）
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Chart tabs */}
      <div style={{padding:"14px 16px 0"}}>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          {[{id:"debt",label:"📉 借金推移"},{id:"invest",label:"📈 積立推移"}].map(t=>(
            <button key={t.id} onClick={()=>setActiveChart(t.id)} style={{
              flex:1,padding:"9px 0",borderRadius:8,border:"none",
              background:activeChart===t.id?"#1F2937":"transparent",
              color:activeChart===t.id?"#fff":"#6B7280",
              fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:"pointer",
              borderBottom:activeChart===t.id?"2px solid #FF6B35":"2px solid transparent",
            }}>{t.label}</button>
          ))}
        </div>

        {/* Debt Chart */}
        {activeChart==="debt" && (
          <div style={{background:"#13131A",border:"1px solid #1F2937",borderRadius:16,padding:"16px 8px 8px"}}>
            <div style={{fontSize:10,color:"#6B7280",letterSpacing:"0.2em",marginBottom:4,paddingLeft:8}}>
              残高推移 — シミュ vs 実績
            </div>
            <div style={{display:"flex",gap:12,paddingLeft:8,marginBottom:12}}>
              {[{c:"#FF6B3560",label:"シミュレーション"},{c:"#FF6B35",label:"実績"}].map(({c,label})=>(
                <div key={label} style={{display:"flex",alignItems:"center",gap:5}}>
                  <div style={{width:24,height:3,background:c,borderRadius:2}}/>
                  <span style={{fontSize:10,color:"#6B7280"}}>{label}</span>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={debtChartData} margin={{left:0,right:8,top:4,bottom:0}}>
                <defs>
                  <linearGradient id="simGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF6B35" stopOpacity={0.15}/>
                    <stop offset="100%" stopColor="#FF6B35" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF6B35" stopOpacity={0.5}/>
                    <stop offset="100%" stopColor="#FF6B35" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false}/>
                <XAxis dataKey="m" tick={{fill:"#6B7280",fontSize:9}} axisLine={false} tickLine={false}
                  tickFormatter={v=>SHOW_LABELS.has(v)?v:""} interval={0}/>
                <YAxis tick={{fill:"#6B7280",fontSize:9}} axisLine={false} tickLine={false}
                  tickFormatter={v=>oku(v)} width={38}/>
                <Tooltip content={<CustomTooltip/>}/>
                {/* 今日 */}
                <ReferenceLine x={TODAY_MONTH} stroke="#FFD700" strokeDasharray="4 4" strokeWidth={1.5}
                  label={{value:"今日",fill:"#FFD700",fontSize:9,position:"top"}}/>
                {/* 楽天完済 */}
                <ReferenceLine x="2026/9" stroke="#A78BFA" strokeDasharray="4 4" strokeWidth={1}
                  label={{value:"楽天✓",fill:"#A78BFA",fontSize:9,position:"top"}}/>
                {/* 全完済 */}
                <ReferenceLine x="2029/4" stroke="#00D4AA" strokeDasharray="4 4" strokeWidth={1}
                  label={{value:"完済🏆",fill:"#00D4AA",fontSize:9,position:"top"}}/>
                {/* シミュ */}
                <Area type="monotone" dataKey="sim" name="シミュ" stroke="#FF6B3550"
                  strokeWidth={1.5} fill="url(#simGrad)" strokeDasharray="4 3" dot={false}/>
                {/* 実績 */}
                <Area type="monotone" dataKey="actual" name="実績" stroke="#FF6B35"
                  strokeWidth={2.5} fill="url(#actGrad)" dot={{r:3,fill:"#FF6B35",stroke:"#FF6B35"}}
                  connectNulls={false}/>
              </ComposedChart>
            </ResponsiveContainer>
            <div style={{textAlign:"center",fontSize:10,color:"#4B5563",marginTop:4}}>
              ← DEBT CRUSHERで返済記録すると実績線が伸びていきます
            </div>
          </div>
        )}

        {/* Investment Chart */}
        {activeChart==="invest" && (
          <div style={{background:"#13131A",border:"1px solid #1F2937",borderRadius:16,padding:"16px 8px 8px"}}>
            <div style={{fontSize:10,color:"#6B7280",letterSpacing:"0.2em",marginBottom:16,paddingLeft:8}}>
              積立推移（実績）
            </div>
            {investChartData.length === 0 ? (
              <div style={{textAlign:"center",color:"#6B7280",fontSize:12,padding:"60px 0"}}>
                DEBT CRUSHERで積立を記録すると<br/>グラフが表示されます
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={investChartData} margin={{left:0,right:8,top:4,bottom:0}}>
                  <defs>
                    <linearGradient id="invGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00D4AA" stopOpacity={0.5}/>
                      <stop offset="100%" stopColor="#00D4AA" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false}/>
                  <XAxis dataKey="m" tick={{fill:"#6B7280",fontSize:9}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:"#6B7280",fontSize:9}} axisLine={false} tickLine={false}
                    tickFormatter={v=>oku(v)} width={38}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Bar dataKey="monthly" name="月次積立" fill="#00D4AA" opacity={0.7} radius={[3,3,0,0]}/>
                  <Area type="monotone" dataKey="cumulative" name="累計" stroke="#00D4AA"
                    strokeWidth={2} fill="url(#invGrad)" dot={false}/>
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </div>

      {/* Footer note */}
      <div style={{padding:"14px 20px 0",textAlign:"center",fontSize:10,color:"#4B5563",lineHeight:1.6}}>
        シミュレーションは2024/4〜2029/4（61ヶ月）<br/>
        実績はDEBT CRUSHERの記録から自動反映
      </div>
    </div>
  );
}
