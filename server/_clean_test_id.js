const https = require('https');
function req(o, b){return new Promise((res,rej)=>{const r=https.request(o,x=>{const c=[];x.on('data',d=>c.push(d));x.on('end',()=>{try{res({s:x.statusCode,body:JSON.parse(Buffer.concat(c).toString())})}catch(e){res({s:x.statusCode,body:Buffer.concat(c).toString().slice(0,100)})}})});r.on('error',rej);if(b)r.write(b);r.end()})}
(async()=>{
  const H='dreamtipper-api.onrender.com';
  const l=await req({hostname:H,path:'/api/auth/login',method:'POST',headers:{'Content-Type':'application/json'}},JSON.stringify({email:'admin@dreamtipper.com',password:'admin123'}));
  const t=l.body.token;
  const list=await req({hostname:H,path:'/api/admin/sweep?limit=3',method:'GET',headers:{Authorization:'Bearer '+t}});
  // 把之前测试设的 sporttery_match_id=67452 的记录清回 null
  const recs=list.body.records.filter(r=>r.sporttery_match_id===67452);
  for(const rec of recs){
    const put=await req({hostname:H,path:'/api/admin/sweep/'+rec.id+'/sporttery-id',method:'PUT',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'}},JSON.stringify({sportteryMatchId:null}));
    console.log('reset',rec.id,rec.home_team,'->',JSON.stringify(put.body));
  }
  if(!recs.length) console.log('no test record to reset');
})().catch(e=>console.log('ERR',e.message));
