const https = require('https');
function get(u){return new Promise((res,rej)=>{const x=new URL(u);https.get({hostname:x.hostname,port:443,path:x.pathname+x.search,headers:{'User-Agent':'Mozilla/5.0','Referer':'https://www.sporttery.cn/'}},r=>{const c=[];r.on('data',d=>c.push(d));r.on('end',()=>{try{res(JSON.parse(Buffer.concat(c).toString()))}catch(e){res({raw:Buffer.concat(c).toString().slice(0,200)})}})}).on('error',rej)})} 
(async()=>{
  const B='https://webapi.sporttery.cn/gateway/uniform/football/';
  for(const ep of ['getMatchFeatureV1.qry','getResultHistoryV1.qry','getMatchTablesV2.qry','getFutureMatchesV1.qry']){
    const r=await get(B+ep+'?sportteryMatchId=67452'+(ep==='getResultHistoryV1.qry'?'&termLimits=10&tournamentFlag=0&homeAwayFlag=0':ep==='getMatchTablesV2.qry'?'':ep==='getFutureMatchesV1.qry'?'&termLimits=4':''));
    const v=r.value;
    if(v===undefined||v==='') console.log(ep.padEnd(22),'ok=',r.success,'value=EMPTY');
    else if(v&&v.matchList) console.log(ep.padEnd(22),'ok=',r.success,'matchList.len=',v.matchList.length);
    else if(v&&v.statistics) console.log(ep.padEnd(22),'ok=',r.success,'statistics.win=',v.statistics.winGoalMatchCnt,'draw=',v.statistics.drawMatchCnt,'loss=',v.statistics.lossGoalMatchCnt,'total=',v.statistics.totalLegCnt);
    else console.log(ep.padEnd(22),'ok=',r.success,'value keys=',v?Object.keys(v).length:'null',v?JSON.stringify(v).slice(0,120):'');
  }
})().catch(e=>console.log('ERR',e.message));
