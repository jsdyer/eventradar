"""Check the built app at its actual Pages subpath using deterministic data."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json, re, shutil, tempfile, threading
from datetime import datetime, timedelta, timezone
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
SLUG='eventradar'
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass

def main():
    with tempfile.TemporaryDirectory() as temporary:
        shutil.copytree(ROOT/'dist',Path(temporary)/SLUG)
        assets=Path(temporary)/'assets';assets.mkdir();(assets/'tool-metrics.js').write_text('')
        server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=temporary))
        threading.Thread(target=server.serve_forever,daemon=True).start()
        try:
            with sync_playwright() as p:
                browser=p.chromium.launch()
                page=browser.new_page(viewport={'width':1280,'height':900})
                errors=[];failed=[]
                page.on('pageerror',lambda error:errors.append(str(error)))
                page.on('console',lambda message:errors.append(message.text) if message.type=='error' else None)
                page.on('response',lambda response:failed.append(response.url) if response.status>=400 and response.url.startswith('http://127.0.0.1:') else None)
                feed={'city':{'slug':'vancouver','countryCode':'CA'},'items':[{'id':'test','title':'Test event','startsAt':(datetime.now(timezone.utc)+timedelta(days=1)).isoformat(),'startTimeKnown':True,'url':'https://example.org/event'}]}
                page.route(re.compile(r'https://[^/]+\.hasthings\.com/feeds/events\.json.*'),lambda route:route.fulfill(json=feed))
                response=page.goto(f'http://127.0.0.1:{server.server_port}/{SLUG}/')
                assert response.ok
                expect(page.locator('h1')).to_be_visible()
                page.locator('#when').select_option('all')
                expect(page.locator('#events article')).to_have_count(1)
                page.get_by_role('button',name='Add Test event to plans',exact=True).click()
                expect(page.locator('#download')).to_be_enabled()
                page.locator('#event-query').fill('No such fixture title')
                expect(page.locator('#events article')).to_have_count(0)
                page.locator('#event-query').fill('')
                for width,height in [(1280,900),(390,844),(320,700)]:
                    page.set_viewport_size({'width':width,'height':height})
                    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), f'horizontal overflow at {width}px'
                assert not errors,errors
                assert not failed,failed
                browser.close()
            print(SLUG+': subpath, interaction, JavaScript errors and mobile overflow checks passed')
        finally:server.shutdown();server.server_close()
if __name__=='__main__':main()
