const SYSTEM='You are AARYA, the AI assistant integrated into YadavBrowser. Be concise, accurate and useful. Do not invent YadavBrowser features.';

module.exports=async function(req,res){
  if(req.method==='GET'){
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({ok:true,service:'aarya',provider:'gemini',configured:Boolean(process.env.GEMINI_API_KEY)});
  }
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  res.setHeader('Cache-Control','no-store');
  try{
    const messages=Array.isArray(req.body?.messages)?req.body.messages:[];
    if(!messages.length||messages.length>30)return res.status(400).json({error:'Invalid messages'});
    const key=process.env.GEMINI_API_KEY;
    if(!key)return res.status(503).json({error:'AARYA backend is not configured on this Vercel deployment.'});
    const model=process.env.AARYA_GEMINI_MODEL||'gemini-2.5-flash';
    const contents=messages.map(m=>({role:m.role==='assistant'||m.role==='model'?'model':'user',parts:[{text:String(m.content||'').slice(0,12000)}]}));
    const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent?key='+encodeURIComponent(key),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:SYSTEM}]},contents,generationConfig:{temperature:0.2}})});
    const data=await r.json();
    if(!r.ok)return res.status(r.status===429?429:502).json({error:data?.error?.message||'Gemini request failed'});
    const text=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';
    if(!text)return res.status(502).json({error:'AARYA returned no text'});
    return res.status(200).json({provider:'gemini',model,text});
  }catch(e){console.error('AARYA API error',e);return res.status(500).json({error:'AARYA backend error'});}
};