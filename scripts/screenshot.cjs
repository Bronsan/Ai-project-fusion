// v0.13 真实页面截图脚本
// 用 puppeteer-core + chrome-headless-shell 对运行中的 web 应用截图
// Web 模式下登录是本地模拟，通过 localStorage 注入登录态
// 关键：首次 autoLogin 后用 SPA 导航（pushState + popstate）避免 store 重置
const puppeteer = require('puppeteer-core')

const BASE = 'http://127.0.0.1:5173'
const OUT = '/workspace/docs/screenshots/v0.13'
const CHROMIUM = '/tmp/chrome/chrome-headless-shell-linux64/chrome-headless-shell'

// SPA 内导航（不刷新页面，保持 zustand store 状态）
async function spaNavigate(page, path) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
  // 等待路由组件渲染
  await new Promise((r) => setTimeout(r, 1500))
}

// 等待选择器或超时
async function waitSelector(page, selector, timeout = 8000) {
  try {
    await page.waitForSelector(selector, { timeout })
  } catch {
    // 超时不报错，继续截图
  }
}

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
      '--font-render-hinting=none',
    ],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
  const navOpts = { waitUntil: 'networkidle0', timeout: 15000 }

  // 1. 登录页（未登录状态）
  console.log('截取登录页...')
  await page.goto(`${BASE}/login`, navOpts)
  await waitSelector(page, 'input')
  await new Promise((r) => setTimeout(r, 2000))
  await page.screenshot({ path: `${OUT}/01-login.png` })
  console.log('  done: 01-login.png')

  // 2. 注入登录态（Web 模式 autoLogin 读 localStorage）
  await page.evaluate(() => {
    localStorage.setItem('pf_remember_token', 'web-mock-token')
    localStorage.setItem('pf_username', 'tester')
  })

  // 3. 重新访问 /login，触发 autoLogin → 自动跳转到 /modules
  console.log('触发 autoLogin 进入模块中心...')
  await page.goto(`${BASE}/login`, navOpts)
  // 等待 autoLogin 完成 + 跳转到 /modules
  await new Promise((r) => setTimeout(r, 3000))
  // 确认已经在 /modules
  const url1 = await page.url()
  console.log('  当前 URL:', url1)
  await new Promise((r) => setTimeout(r, 1500))
  await page.screenshot({ path: `${OUT}/02-modules.png` })
  console.log('  done: 02-modules.png')

  // 4. 选择项目页（SPA 导航，保持登录态）
  console.log('截取选择项目页...')
  await spaNavigate(page, '/select')
  await page.screenshot({ path: `${OUT}/03-select.png` })
  console.log('  done: 03-select.png')

  // 5. 配置页
  console.log('截取配置页...')
  await spaNavigate(page, '/configure')
  await page.screenshot({ path: `${OUT}/04-configure.png` })
  console.log('  done: 04-configure.png')

  // 6. 历史页
  console.log('截取历史页...')
  await spaNavigate(page, '/history')
  await page.screenshot({ path: `${OUT}/05-history.png` })
  console.log('  done: 05-history.png')

  // 7. 设置页（含版本号和 changelog）
  console.log('截取设置页...')
  await spaNavigate(page, '/settings')
  await page.screenshot({ path: `${OUT}/06-settings.png` })
  console.log('  done: 06-settings.png')

  // 8. 报告页（空状态）
  console.log('截取报告页...')
  await spaNavigate(page, '/report')
  await page.screenshot({ path: `${OUT}/07-report.png` })
  console.log('  done: 07-report.png')

  // 9. 浅色主题 - 在设置页切换主题，然后导航到模块中心
  console.log('截取浅色主题...')
  await spaNavigate(page, '/settings')
  await new Promise((r) => setTimeout(r, 500))
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
  await spaNavigate(page, '/modules')
  await page.screenshot({ path: `${OUT}/08-light-mode.png` })
  console.log('  done: 08-light-mode.png')

  // 10. 登录页 - 注册模式
  console.log('截取注册模式...')
  // 清除登录态，整页刷新到 /login
  await page.evaluate(() => {
    localStorage.removeItem('pf_remember_token')
    localStorage.removeItem('pf_username')
  })
  await page.goto(`${BASE}/login`, navOpts)
  await waitSelector(page, 'input')
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
