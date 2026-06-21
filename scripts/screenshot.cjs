// v0.13beta 真实页面截图脚本
// 用 puppeteer-core + chrome-headless-shell 对运行中的 web 应用截图
// Web 模式下登录是本地模拟，通过 localStorage 注入登录态
const puppeteer = require('puppeteer-core')

const BASE = 'http://127.0.0.1:5173'
const OUT = '/workspace/docs/screenshots/v0.13'
const CHROMIUM = '/tmp/chrome/chrome-headless-shell-linux64/chrome-headless-shell'

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1440,900',
    ],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
  const navOpts = { waitUntil: 'networkidle0', timeout: 15000 }

  // 1. 登录页（未登录状态）
  console.log('截取登录页...')
  await page.goto(`${BASE}/login`, navOpts)
  await page.waitForSelector('input', { timeout: 8000 })
  await new Promise((r) => setTimeout(r, 2000))
  await page.screenshot({ path: `${OUT}/01-login.png` })
  console.log('  done: 01-login.png')

  // 2. 注入登录态（Web 模式 autoLogin 读 localStorage）
  await page.evaluate(() => {
    localStorage.setItem('pf_remember_token', 'web-mock-token')
    localStorage.setItem('pf_username', 'tester')
  })

  // 3. 模块中心
  console.log('截取模块中心...')
  await page.goto(`${BASE}/modules`, navOpts)
  await new Promise((r) => setTimeout(r, 2000))
  await page.screenshot({ path: `${OUT}/02-modules.png` })
  console.log('  done: 02-modules.png')

  // 4. 选择项目页
  console.log('截取选择项目页...')
  await page.goto(`${BASE}/select`, navOpts)
  await new Promise((r) => setTimeout(r, 2000))
  await page.screenshot({ path: `${OUT}/03-select.png` })
  console.log('  done: 03-select.png')

  // 5. 配置页
  console.log('截取配置页...')
  await page.goto(`${BASE}/configure`, navOpts)
  await new Promise((r) => setTimeout(r, 2000))
  await page.screenshot({ path: `${OUT}/04-configure.png` })
  console.log('  done: 04-configure.png')

  // 6. 历史页
  console.log('截取历史页...')
  await page.goto(`${BASE}/history`, navOpts)
  await new Promise((r) => setTimeout(r, 2000))
  await page.screenshot({ path: `${OUT}/05-history.png` })
  console.log('  done: 05-history.png')

  // 7. 设置页（含版本号和 changelog）
  console.log('截取设置页...')
  await page.goto(`${BASE}/settings`, navOpts)
  await new Promise((r) => setTimeout(r, 2000))
  await page.screenshot({ path: `${OUT}/06-settings.png` })
  console.log('  done: 06-settings.png')

  // 8. 报告页（空状态）
  console.log('截取报告页...')
  await page.goto(`${BASE}/report`, navOpts)
  await new Promise((r) => setTimeout(r, 2000))
  await page.screenshot({ path: `${OUT}/07-report.png` })
  console.log('  done: 07-report.png')

  // 9. 浅色主题 - 在设置页切换主题
  console.log('截取浅色主题...')
  await page.goto(`${BASE}/settings`, navOpts)
  await new Promise((r) => setTimeout(r, 1500))
  // 点击主题切换按钮（太阳/月亮图标）
  const switched = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'))
    const themeBtn = btns.find((b) => {
      const svg = b.querySelector('svg')
      return svg && (svg.classList.contains('lucide-sun') || svg.classList.contains('lucide-moon'))
    })
    if (themeBtn) {
      themeBtn.click()
      return true
    }
    return false
  })
  console.log('  主题切换:', switched ? '成功' : '未找到按钮')
  await new Promise((r) => setTimeout(r, 1000))
  await page.goto(`${BASE}/modules`, navOpts)
  await new Promise((r) => setTimeout(r, 2000))
  await page.screenshot({ path: `${OUT}/08-light-mode.png` })
  console.log('  done: 08-light-mode.png')

  // 10. 登录页 - 注册模式
  console.log('截取注册模式...')
  // 清除登录态
  await page.evaluate(() => {
    localStorage.removeItem('pf_remember_token')
    localStorage.removeItem('pf_username')
  })
  await page.goto(`${BASE}/login`, navOpts)
  await page.waitForSelector('input', { timeout: 8000 })
  await new Promise((r) => setTimeout(r, 1500))
  // 点击"注册"切换按钮
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'))
    const regBtn = btns.find((b) =>
      b.textContent.includes('注册') || b.textContent.includes('Register') ||
      b.querySelector('svg.lucide-user-plus')
    )
    if (regBtn) regBtn.click()
  })
  await new Promise((r) => setTimeout(r, 1000))
  await page.screenshot({ path: `${OUT}/09-register.png` })
  console.log('  done: 09-register.png')

  await browser.close()
  console.log('全部截图完成')
}

main().catch((e) => {
  console.error('截图失败:', e)
  process.exit(1)
})
