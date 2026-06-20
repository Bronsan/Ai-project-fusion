// 应用根组件 - 路由配置

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import AuroraBackground from '@/components/AuroraBackground'
import Navbar from '@/components/Navbar'
import Home from '@/pages/Home'
import Select from '@/pages/Select'
import Configure from '@/pages/Configure'
import Execute from '@/pages/Execute'
import Report from '@/pages/Report'

export default function App() {
  return (
    <Router>
      <AuroraBackground />
      <Navbar />
      <main className="relative z-10 pt-16 min-h-screen">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/select" element={<Select />} />
          <Route path="/configure" element={<Configure />} />
          <Route path="/execute/:taskId" element={<Execute />} />
          <Route path="/report/:taskId" element={<Report />} />
        </Routes>
      </main>
    </Router>
  )
}
