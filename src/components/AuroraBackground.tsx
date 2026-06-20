// 极光背景 - 全屏流动的渐变光斑

export default function AuroraBackground() {
  return (
    <>
      <div className="aurora-bg">
        <div className="aurora-blob b1" />
        <div className="aurora-blob b2" />
        <div className="aurora-blob b3" />
      </div>
      <div className="noise-overlay" />
    </>
  )
}
