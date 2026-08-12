'use client'
import { useEffect, useState } from 'react'
export default function Page() {
  const [data, setData] = useState<any>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    fetch('/api/words').then(r => r.text()).then(t => {
      try { setData(JSON.parse(t)) } catch { setErr(t.slice(0,100)) }
    }).catch(e => setErr(String(e)))
  }, [])
  return <div style={{padding:20, fontFamily:'serif'}}>
    <h1>Vocabulary Agent ✅</h1>
    <input placeholder="Search word..." style={{padding:10,width:'100%',maxWidth:400}}/>
    {err && <p>API: {err}</p>}
    <pre>{JSON.stringify(data,null,2)}</pre>
  </div>
}
