import sys, json, asyncio
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8080/'
CASOS = json.loads(sys.argv[2]) if len(sys.argv) > 2 else []
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        erros = []
        for nome, query, w, h in CASOS:
            pg = await b.new_page(viewport={'width': w, 'height': h})
            pg.on('console', lambda m, n=nome: erros.append(f'{n}: [{m.type}] {m.text}') if m.type in ('error', 'warning') else None)
            pg.on('pageerror', lambda e, n=nome: erros.append(f'{n}: PAGEERROR {e}'))
            await pg.goto(BASE + query)
            await pg.wait_for_function('document.body.classList.contains("pronto")', timeout=15000)
            await pg.wait_for_timeout(2500)
            await pg.screenshot(path=f'screenshots/{nome}.png')
            hud = await pg.inner_text('#hud')
            print(nome, '|', hud)
            await pg.close()
        await b.close()
        print('ERROS:', erros if erros else 'nenhum')
asyncio.run(main())
