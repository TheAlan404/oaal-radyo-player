// because MEB root certificate
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const { existsSync, rmSync, readFileSync, writeFileSync } = require("fs");

const defaultConfig = JSON.stringify({
	"// site admin passwd": null,
	PASSWD: "",
	"// true = local txt kullan. false = sitedekileri kullan": null,
	useFromList: false,
	"// true = loop modu, silmez. false = siteden sil ve her zaman ilkini çal": null,
	useIndex: true,
	"// maksimum çalma süresi, ms, 0 = sonsuz": null,
	MAX_LENGTH: 0,
});

if (!existsSync("./config.json")) {
	writeFileSync("./config.json", );
	console.log("Config oluşturuldu. Lütfen düzenleyip yeniden başlatın.");
	process.exit();
}

let {
	PASSWD = "",
	useFromList = false,
	useIndex = true,
	MAX_LENGTH = 0,
	chromeChannel = "chrome",
	isHeadless = false,
	navigateToBlank = true,
} = require("config.json");

const ytdl = require("ytdl-core")
const fetch = require("node-fetch")
const puppeteer = require("puppeteer");
const { execSync } = require("child_process");

const delay = (d) => new Promise((res) => setTimeout(res, d));
let currentPromiseResolver;
let getResolve = () => currentPromiseResolver;
const SKIP_AD_SELECTOR = "#skip-button\:l > span > button";




let index = 0;
let firstRun = true;


let localSongList = [];
if(existsSync("./songs.txt")) {
	setInterval(() => {
		localSongList = readFileSync("./songs.txt").toString().replace(/\r/g, "").split("\n").map(x => x.trim()).filter(x => x[0] != "#").map(s => {
			return { id: s };
		});
	}, 1 * 60 * 1000);
}

async function run() {
	console.log("Browser açılıyor...");
	let browser = await puppeteer.launch({
		headless: isHeadless,
		channel: chromeChannel,
	});

	let page = await browser.newPage();
	
	await page.exposeFunction('onCustomEvent', ({ type, detail }) => {
		getResolve()();
	});

	const Loop = async () => {
		await delay(2);
		console.log("> Yeni şarkı alınıyor");
		
		let song;

		if(!useFromList) {
			let resp = await fetch("https://oaal.glitch.me/api/radio/data.json")
			let { songs } = await resp.json();
			song = songs[(useIndex ? index : 0)];
		} else {
			song = localSongList[index];
		}

		index++;

		if(!useIndex && !firstRun) {
			await fetch("/api/songs/delete?passwd=" + PASSWD + "&i=0", {
				method: "POST"
			});
		}

		if(!song) {
			console.log("Yeni şarkı yok! 1 dakika bekleniliyor.");
			index = 0;
			await delay(60 * 1000);
			Loop();
		}
		console.log("Şarkı oynatılacak: " + song.name);
		console.log("Linki: " + song.url);
		console.log("ID: " + song.id);
		
		let promise = new Promise((res) => {
			currentPromiseResolver = res;
		});
		
		await page.goto("https://tube.kuylar.dev/watch?v=" + song.id);

		await delay(2000);
		await page.evaluate(() => {
			document.querySelector("video").click();
			
			document.querySelector("video").addEventListener('ended', (...a) => {
				window.onCustomEvent(...a);
			});
		})
		await delay(2000);

		let tout;
		let toutExceeded = false;
		let framNavd = false;
		
		if(MAX_LENGTH > 0) {
			tout = setTimeout(async () => {
				if(framNavd) return;
				console.log("Zaman limiti aşıldı. Kapatılıyor");
				toutExceeded = true;
				if (navigateToBlank) {
					try { await page.goto("https://example.com"); } catch(e) {
						console.log(e);
					}
				}
				Loop();
			}, MAX_LENGTH);
		}
		
		firstRun = false;
		
		await promise;
		if(toutExceeded) return;
		framNavd = true;
		if (tout) clearTimeout(tout);
		if (navigateToBlank) {
			try { await page.goto("https://example.com"); } catch(e) {
				console.log(e);
			}
		}
		console.log("Şarkı bitmiş olmalı");
		Loop();
	}

	Loop();
}

run();