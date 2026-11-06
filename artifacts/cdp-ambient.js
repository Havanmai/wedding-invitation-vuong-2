const { spawn } = require("child_process");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9344;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const edge = spawn(EDGE, ["--headless=new","--disable-gpu","--hide-scrollbars","--window-size=1280,900",
    `--remote-debugging-port=${PORT}`,"--user-data-dir=D:/Learn/Vuong/artifacts/.edge-amb","about:blank"],{stdio:"ignore"});
  let t=null; for(let i=0;i<40&&!t;i++){await sleep(500);try{t=await(await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();}catch(e){}}
  const page=t.find(x=>x.type==="page");
  const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
  let id=0; const pend=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}};
  const send=(m,p={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}));});
  const ev=async x=>{const r=await send("Runtime.evaluate",{expression:x,returnByValue:true,awaitPromise:true});
    if(r.result?.exceptionDetails) return "ERR: "+r.result.exceptionDetails.exception?.description;
    return r.result?.result?.value;};
  await send("Page.enable"); await send("Runtime.enable");
  await send("Page.navigate",{url:"http://127.0.0.1:8123/vuong.html"});
  await sleep(5000);
  console.log(await ev(`(() => {
    const o = document.querySelector('[data-landing-screenshot-id="invite-envelope"]');
    const host = o.querySelector('div[style="z-index: 1"]');
    const kids = Array.from(host.children);
    const r = (el)=>{const b=el.getBoundingClientRect();return {x:Math.round(b.left),y:Math.round(b.top),w:Math.round(b.width),h:Math.round(b.height)};};
    return JSON.stringify({
      hostRect: r(host),
      hostOverflow: getComputedStyle(host).overflow,
      count: kids.length,
      kids: kids.map(k => {
        const cs = getComputedStyle(k);
        return { text: k.textContent.trim(), rect: r(k), opacity: cs.opacity, transform: cs.transform,
                 color: cs.color, fontSize: cs.fontSize, display: cs.display, visibility: cs.visibility,
                 animName: cs.animationName, animDelay: cs.animationDelay, zIndex: cs.zIndex };
      }),
    }, null, 2);
  })()`));
  const res=await send("Page.captureScreenshot",{format:"png"});
  require("fs").writeFileSync("D:/Learn/Vuong/artifacts/cover-ambient.png", Buffer.from(res.result.data,"base64"));
  console.log("wrote cover-ambient.png");
  ws.close(); edge.kill();
})().catch(e=>{console.error("FAILED",e);process.exit(1);});
