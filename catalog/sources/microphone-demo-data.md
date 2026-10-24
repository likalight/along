# Microphones for AI prompting and dictation — 50-product demo dataset

Research date: **24 October 2026 (Asia/Singapore)**. Currency: **USD**. Reference market: **public US-oriented retail and manufacturer listings**. Exactly **50 distinct product / kit configurations**.

This is research-backed hackathon seed data, with clearly marked synthetic price placeholders and authored suitability scores. It is not a live shopping feed or a measured speech-recognition benchmark. The same date applies to every row; retrieved pages and search indexes may contain older snapshots.

## How to read the data

- **Prices:** Item / selected-kit reference prices, excluding shipping, tax, import costs, and extra hardware. No SGD conversion is implied. A low microphone price can still require an interface, cable, adapter, or stand.
- **Availability:** Applies only to the cited seller / page. `unknown` means stock was not exposed, not that the product is unavailable. `in_stock_search` is weaker evidence from an indexed search result. Singapore delivery and local inventory were not checked.
- **Reviews:** Real customer aggregates or visible review counts where captured; missing values are `null`, never zero. Customer reviews generally concern calls, music, or recording, and do not establish dictation accuracy. Summaries below paraphrase inspected customer reviews. No customer reviews or ratings were invented.
- **Demo fit:** Authored, synthetic 1–5 suitability hypotheses for recommendation filtering: 1 = poor initial candidate; 3 = conditional; 5 = strong initial candidate. Scores assume correct placement and a compatible audio path. They are independent of customer stars and do not account for current stock. They are not measured word-error-rate results.
- **Sources:** Product identity and key specifications were checked against public manufacturer / merchant pages and indexed listings. Pages that hid stock, prices, or ratings remain explicitly incomplete. No signed-in cart, delivery promise, or checkout was used.

### Price provenance

| `price_kind` | Meaning |
| --- | --- |
| `observed_page` | Exact displayed price extracted from a product page for the stated configuration. |
| `search_snapshot` | Price shown in an indexed search result; freshness / checkout not confirmed. |
| `search_range_floor` | Lowest amount in a displayed offer range; not a confirmed single offer. |
| `from_price` | Manufacturer advertises a starting price; exact selected variant may differ. |
| `manufacturer_rrp` | Manufacturer recommended retail price, not a seller quote. |
| `historical_page` | Legacy page amount for a discontinued product; not a live offer. |
| `demo_estimate` | Synthetic placeholder for the demo, unsupported as a current offer. |

## Product and commercial data

`id` joins all three tables. All numeric prices below are USD. Category labels describe form factor / connection rather than implying that professional equipment always performs better.


| id | brand | model / exact configuration | category | reference_price_usd | price_kind | availability | seller / source | product_source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MIC-001 | Apple | EarPods (USB-C) | Wired earbuds | 19.00 | search_snapshot | in_stock | Apple / Target | [Listing](https://www.apple.com/shop/product/myqy3am/a/earpods-usb-c) |
| MIC-002 | Apple | EarPods (3.5mm Headphone Plug) | Wired earbuds | 19.00 | search_snapshot | unknown | Apple | [Listing](https://www.apple.com/shop/product/mwu53am/a/earpods-35mm-headphone-plug) |
| MIC-003 | Logitech | H390 (USB-A) | Wired office headset | 21.99 | search_snapshot | unknown | Logitech | [Listing](https://www.logitech.com/en-us/shop/p/h390-usb-headset) |
| MIC-004 | Logitech | H540 | Wired office headset | 39.99 | observed_page | low_stock | Logitech | [Listing](https://www.logitech.com/en-us/shop/p/h540-usb-computer-noise-cancelling) |
| MIC-005 | Logitech | Zone Wired (Teams, Graphite) | Wired office headset | 99.99 | search_range_floor | unknown | Best Buy | [Listing](https://www.bestbuy.com/product/logitech-zone-wired-noise-cancelling-on-ear-headset-for-microsoft-teams-graphite/J7H7ZY3CHS) |
| MIC-006 | Logitech | Zone Vibe 100 (Graphite) | Wireless office headset | 79.99 | observed_page | in_stock | Logitech | [Listing](https://www.logitech.com/en-us/shop/p/zone-vibe-100-wireless) |
| MIC-007 | Jabra | Evolve 20 UC Stereo (4999-829-289-01) | Wired office headset | 45.00 | observed_page | in_stock_search | CDW | [Listing](https://www.cdw.com/product/jabra-evolve-20-uc-stereo-headset-usb-c-usb-a/8404753) |
| MIC-008 | Jabra | Evolve2 40 SE UC Stereo | Wired office headset | 160.00 | observed_page | unknown | Headsets Direct | [Listing](https://www.headsetsdirect.com/product/jabra-evolve2-40-uc-stereo-usb-headset/) |
| MIC-009 | Jabra | Evolve2 65 Flex Link380a UC Stereo | Wireless office headset | 277.00 | search_snapshot | unknown | Lenovo US | [Listing](https://www.lenovo.com/us/en/p/accessories-and-software/audio/headsets/78806811) |
| MIC-010 | HP Poly | Blackwire 3220 (8X228AA) | Wired office headset | 43.99 | observed_page | unknown | CDW | [Listing](https://www.cdw.com/product/poly-blackwire-3220-stereo-usb-c-headset-usb-c-a-adapter/7775308) |
| MIC-011 | HP Poly | Blackwire 5220 (8X231AA) | Wired office headset | 103.99 | observed_page | unknown | CDW | [Listing](https://www.cdw.com/product/poly-blackwire-5220-stereo-usb-c-headset-3.5mm-plug-usb-c-a-adapter/7775314) |
| MIC-012 | HP Poly | Voyager Focus 2 UC (9T9J3AA#AC3) | Wireless office headset | 229.99 | observed_page | unknown | CDW | [Listing](https://www.cdw.com/product/poly-voyager-focus-2-binaural-wireless-headset-usb-c-a-adapter-uc/7906770) |
| MIC-013 | HP Poly | Voyager 5200 UC USB-A + BT700 | Wireless mono headset | 264.95 | search_snapshot | unknown | First Source Wireless | [Listing](https://firstsourcewireless.com/products/poly-voyager-5200-uc-usb-a-bluetooth-headset-bt700-adapter) |
| MIC-014 | Shure | WH20XLR | Professional headworn mic | 99.00 | search_snapshot | in_stock_search | B&H | [Listing](https://www.bhphotovideo.com/c/product/162051-REG/Shure_WH20XLR_WH20XLR_Headworn_Dynamic.html) |
| MIC-015 | Shure | MV6 Gen 2 (Black) | USB dynamic mic | 169.00 | observed_page | in_stock | Sweetwater | [Listing](https://www.sweetwater.com/store/detail/MV6G2K--shure-mv6-gen-2-usb-gaming-microphone-black) |
| MIC-016 | Shure | MV7+ (Black) | USB/XLR dynamic mic | 299.00 | observed_page | in_stock | Sweetwater | [Listing](https://www.sweetwater.com/store/detail/MV7pBK--shure-mv7-hybrid-podcast-microphone-black) |
| MIC-017 | RØDE | PodMic USB | USB/XLR dynamic mic | 209.00 | observed_page | in_stock | Sweetwater | [Listing](https://www.sweetwater.com/store/detail/PodMicUSB--rode-podmic-usb-dynamic-broadcast-microphone) |
| MIC-018 | Audio-Technica | ATR2100x-USB | USB/XLR dynamic mic | 99.99 | demo_estimate | discontinued | Audio-Technica | [Listing](https://www.audio-technica.com/en-us/atr2100x-usb) |
| MIC-019 | Samson | Q2U Recording and Podcasting Pack | USB/XLR dynamic mic | 99.99 | observed_page | in_stock | Sweetwater | [Listing](https://www.sweetwater.com/store/detail/Q2UPack--samson-q2u-recording-and-podcasting-pack-usb-xlr-dynamic-microphone-with-accessories) |
| MIC-020 | FIFINE | AmpliGame AM8 (base stand + USB cable) | USB/XLR dynamic mic | 57.99 | observed_page | unknown | FIFINE | [Listing](https://fifinemicrophone.com/collections/microphones/products/fifine-ampligame-am8-microphone) |
| MIC-021 | MAONO | PD200X + BA20 boom arm | USB/XLR dynamic mic | 89.99 | observed_page | unknown | MAONO | [Listing](https://www.maono.com/products/maono-pd200x-dynamic-usb-and-xlr-internet-microphone) |
| MIC-022 | RØDE | NT-USB Mini | USB condenser mic | 109.00 | observed_page | in_stock | Sweetwater | [Listing](https://www.sweetwater.com/store/detail/NTUSBMini--rode-nt-usb-mini-usb-condenser-microphone) |
| MIC-023 | RØDE | NT-USB+ | USB condenser mic | 179.00 | search_snapshot | unknown | Sweetwater | [Listing](https://www.sweetwater.com/store/detail/NTUSBp--rode-nt-usb-usb-condenser-microphone) |
| MIC-024 | Logitech / Blue | Yeti (Blackout) | USB condenser mic | 109.99 | observed_page | in_stock | Logitech G | [Listing](https://www.logitechg.com/en-us/shop/p/yeti-premium-usb-microphone) |
| MIC-025 | Logitech / Blue | Snowball iCE (Black) | USB condenser mic | 49.99 | observed_page | unavailable | Logitech G | [Listing](https://www.logitechg.com/en-us/shop/p/snowball-ice-usb-microphone) |
| MIC-026 | Elgato | Wave:3 MK.2 | USB condenser mic | 169.99 | observed_page | unknown | Elgato | [Listing](https://www.elgato.com/us/en/p/wave-3) |
| MIC-027 | HyperX | SoloCast 2 | USB condenser mic | 44.99 | observed_page | in_stock | HyperX US | [Listing](https://hyperx.com/products/hyperx-solocast-2-gaming-usb-condenser-microphone) |
| MIC-028 | HyperX | QuadCast S (Black) | USB condenser mic | 99.99 | observed_page | in_stock | HyperX US | [Listing](https://hyperx.com/products/hyperx-quadcast-s-usb-microphone) |
| MIC-029 | Razer | Seiren V3 Mini (Black) | USB condenser mic | 59.99 | from_price | unknown | Razer US | [Listing](https://www.razer.com/streaming-microphones/razer-seiren-v3-mini) |
| MIC-030 | Shure | SM58 | Professional XLR dynamic mic | 109.00 | observed_page | in_stock | Sweetwater | [Listing](https://www.sweetwater.com/store/detail/SM58--shure-sm58-cardioid-dynamic-vocal-microphone) |
| MIC-031 | Shure | SM7B | Professional XLR dynamic mic | 439.00 | observed_page | in_stock | Sweetwater | [Listing](https://www.sweetwater.com/store/detail/SM7B--shure-sm7b-cardioid-dynamic-vocal-microphone) |
| MIC-032 | RØDE | PodMic (XLR, Black) | Professional XLR dynamic mic | 99.00 | observed_page | in_stock | Sweetwater | [Listing](https://www.sweetwater.com/store/detail/PodMic--rode-podmic-dynamic-broadcast-microphone) |
| MIC-033 | Audio-Technica | AT2020 (XLR) | Professional XLR condenser mic | 119.00 | observed_page | in_stock | Sweetwater | [Listing](https://www.sweetwater.com/store/detail/AT2020--audio-technica-at2020-cardioid-condenser-microphone) |
| MIC-034 | Sennheiser | e 835 | Professional XLR dynamic mic | 99.95 | observed_page | in_stock | Sweetwater | [Listing](https://www.sweetwater.com/store/detail/E835--sennheiser-e-835-cardioid-dynamic-vocal-microphone) |
| MIC-035 | BOYA | BY-M1 Classic | Wired lavalier | 32.99 | observed_page | in_stock | BOYA | [Listing](https://store.boyamic.com/products/by-m1) |
| MIC-036 | RØDE | smartLav+ | Wired lavalier | 79.99 | demo_estimate | unknown | RØDE | [Listing](https://rode.com/en-us/products/smartlav-plus) |
| MIC-037 | RØDE | Lavalier GO (Black) | Wired lavalier | 89.00 | observed_page | in_stock | Sweetwater | [Listing](https://www.sweetwater.com/store/detail/LavalierGO--rode-lavalier-go-professional-wearable-microphone) |
| MIC-038 | DJI | Mic Mini (1 TX + 1 RX) | Wireless clip-on kit | 59.00 | search_snapshot | out_of_stock | DJI Store | [Listing](https://store.dji.com/product/dji-mic-mini) |
| MIC-039 | DJI | Mic 2 (1 TX + 1 RX) | Wireless clip-on kit | 129.00 | observed_page | out_of_stock | DJI Store | [Listing](https://store.dji.com/product/dji-mic-2-tx-rx) |
| MIC-040 | RØDE | Wireless ME (single TX kit) | Wireless clip-on kit | 149.00 | observed_page | in_stock | Sweetwater | [Listing](https://www.sweetwater.com/store/detail/WirelessME--rode-wireless-me-clip-on-wireless-microphone-system) |
| MIC-041 | RØDE | Wireless GO II Single | Wireless clip-on kit | 199.00 | demo_estimate | discontinued_at_seller | Sweetwater | [Listing](https://www.sweetwater.com/store/detail/WirelessGO2Sg--rode-wireless-go-ii-single-channel-wireless-microphone-system) |
| MIC-042 | Hollyland | LARK M2 Combo (Black) | Wireless clip-on kit | 99.00 | observed_page | unknown | Hollyland | [Listing](https://store.hollyland.com/products/lark-m2) |
| MIC-043 | Saramonic | Blink 500 B2+ (2-person kit) | Wireless clip-on kit | 129.00 | demo_estimate | unknown | Saramonic USA | [Listing](https://saramonicusa.com/blink-500-b2-micro-2-person-digital-wireless-microphone-system-for-cameras-smartphones-computers/) |
| MIC-044 | RØDE | VideoMic GO II with Helix mount | Directional / shotgun mic | 109.00 | observed_page | in_stock | Sweetwater | [Listing](https://www.sweetwater.com/store/detail/VideoMicGo2H--rode-videomic-go-ii-camera-mounted-shotgun-microphone) |
| MIC-045 | RØDE | VideoMic NTG | Directional / shotgun mic | 259.00 | observed_page | in_stock | Sweetwater | [Listing](https://www.sweetwater.com/store/detail/VideoMicNTG--rode-videomic-ntg-camera-mount-shotgun-microphone) |
| MIC-046 | Sennheiser | MKE 400 (2nd generation) | Directional / shotgun mic | 219.00 | observed_page | in_stock | Sweetwater | [Listing](https://www.sweetwater.com/store/detail/MKE400v2--sennheiser-mke400-supercardioid-condenser-on-camera-shotgun-microphone) |
| MIC-047 | Deity | V-Mic D4 Mini | Directional / shotgun mic | 49.95 | observed_page | in_stock | Deity | [Listing](https://shop.deitymic.com/products/d4-mini) |
| MIC-048 | Philips | SpeechMike Premium LFH3500 | Professional handheld dictation | 399.00 | manufacturer_rrp | unknown | Philips Speech Processing | [Listing](https://www.speechmike.com/us/products/desktop-dictation/speechmike-premium-dictation-microphone-lfh3500/) |
| MIC-049 | Philips | SpeechOne PSM6300 kit (PSM6000 family) | Professional wireless dictation | 492.00 | historical_page | discontinued | StartStop / HTH Engineering | [Listing](https://www.startstop.com/philips-speechone-wireless-dictation-headset/) |
| MIC-050 | OM SYSTEM / Olympus | RecMic II RM-4010P | Professional handheld dictation | 349.99 | observed_page | unknown | TVPS / Executive Communication Systems | [Listing](https://www.tvps.com/olympus-recmic-ii-rm-4010p-noise-canceling-push-button-dictation-microphone/ol-rm-4010p/) |


## Capture, compatibility, and authored dictation assessment

`demo_cafe_fit` and `demo_office_fit` are synthetic 1–5 scores. “Noise-canceling” in a headset microphone description concerns the outgoing voice path; headphone ANC concerns what the wearer hears. Neither is proof of better transcription. Directional pickup and close placement can help the voice dominate background sound; no microphone can guarantee removal of competing speech. A dynamic capsule alone does not guarantee better noise rejection than a condenser.

Technical details refer to the model / selected configuration. `Unspecified` means the captured sources did not establish a reliable value. Additional-hardware entries are setup guidance; those items are excluded from the reference price unless explicitly included.


| id | capsule / mic system | polar_pattern | connection | power | additional_hardware | noise_strategy | demo_cafe_fit | demo_office_fit | authored_assessment |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MIC-001 | Unspecified | Unspecified | USB-C | USB bus | None with compatible USB-C host | Inline microphone; no dedicated mic noise suppression verified | 2 | 3 | Low-cost baseline for a laptop bag; keep the inline mic clear of clothing. Nearby speech can still interfere. |
| MIC-002 | Unspecified | Unspecified | 3.5mm TRRS | Host mic input | CTIA-compatible microphone input or USB audio adapter with mic support | Inline microphone; no dedicated mic noise suppression verified | 2 | 3 | Cheap analog baseline; a headphone-only socket will not capture the microphone. |
| MIC-003 | Unspecified headset mic | Unspecified | USB-A | USB bus | USB-C adapter if required | Noise-canceling boom microphone | 4 | 4 | Useful budget starting point: the boom keeps speech close while leaving both hands free. |
| MIC-004 | Unspecified headset mic | Unspecified | USB-A | USB bus | USB-C adapter if required | Noise-canceling boom microphone | 4 | 4 | Straightforward desk headset with mute controls; useful for repeated prompt dictation. |
| MIC-005 | Dual microphone system | Unspecified | USB-C; USB-A adapter | USB bus | Confirm USB adapter in chosen seller package | Dual-mic background-noise reduction | 4 | 5 | A work-focused option for an open office; verify the exact connector and Teams SKU. |
| MIC-006 | Dual microphone system | Unspecified | Bluetooth | Rechargeable battery | Bluetooth-capable host | Beamforming / noise-canceling microphone system | 3 | 4 | Comfortable wireless concept for moving around an office; test the Bluetooth recording path in the dictation app. |
| MIC-007 | Unspecified headset mic | Unspecified | USB-C / USB-A | USB bus | None for matching USB host | Noise-canceling boom microphone | 4 | 4 | Entry-level business headset for long dictation sessions without holding a mic. |
| MIC-008 | 3-microphone system | Unspecified | USB-C; USB-A adapter | USB bus | None for matching USB host | 3-microphone call-noise reduction | 4 | 5 | Good candidate for a fixed office setup where microphone position and all-day comfort matter. |
| MIC-009 | Multi-microphone system | Beamforming / unspecified physical pattern | Bluetooth; Link380a USB-A receiver | Rechargeable battery | USB-C adapter for receiver if needed | ClearVoice microphone processing; headphone ANC is separate | 5 | 5 | Portable premium headset candidate for café prompting; keep the boom correctly positioned. |
| MIC-010 | Unspecified headset mic | Unresolved: retailer lists omnidirectional | USB-C; USB-A adapter | USB bus | None for matching USB host | Boom placement; manufacturer markets noise-canceling mic | 4 | 4 | Affordable hands-free dictation candidate; verify the mic specification for the exact HP SKU. |
| MIC-011 | Unspecified headset mic | Unresolved: retailer lists omnidirectional | USB-C; USB-A adapter; 3.5mm | USB bus / analog host | Compatible mic input for analog mode | Boom placement; manufacturer noise-canceling mic | 4 | 5 | Flexible wired option when moving between USB laptops and devices with a headset jack. |
| MIC-012 | Multi-microphone system | Unspecified | Bluetooth; USB-C receiver + USB-A adapter | Rechargeable battery | Included receiver; confirm package | Acoustic Fence microphone processing; separate headphone ANC | 5 | 5 | Strong premium candidate for noisy-office dictation; compare processed audio with recognition accuracy. |
| MIC-013 | Multi-microphone system | Unspecified | Bluetooth; BT700 USB-A receiver | Rechargeable battery | USB-C adapter for receiver if needed | Multi-microphone noise reduction; WindSmart | 4 | 4 | Compact single-ear option for café work; ear-hook comfort is worth trying before long sessions. |
| MIC-014 | Dynamic | Cardioid | 3-pin XLR | No phantom power required | XLR audio interface + cable; no headphones included | Close boom position and directional pickup | 4 | 5 | A headworn microphone-only option for keeping the capsule near the mouth while typing. |
| MIC-015 | Dynamic | Cardioid | USB-C | USB bus | Included desk stand; optional boom arm | Directional pickup; denoiser; auto level; pop suppression | 4 | 5 | Easy USB desk candidate for prompting; place it close enough that the voice dominates the café. |
| MIC-016 | Dynamic | Cardioid | USB-C; XLR | USB bus; interface in XLR mode | Stand / boom arm; interface only for XLR | Directional close capture; DSP denoising and level control | 4 | 5 | Flexible desk microphone for dictation plus content work; a substantial setup for carrying to cafés. |
| MIC-017 | Dynamic | Cardioid | USB-C; XLR | USB bus; interface in XLR mode | Stand / boom arm; interface only for XLR | Close directional capture; APHEX DSP via USB | 4 | 5 | Useful fixed-desk candidate for spoken prompts; heavy compared with a clip-on or headset. |
| MIC-018 | Dynamic | Cardioid | USB-C; XLR | USB bus; interface in XLR mode | Stand / boom arm; interface only for XLR | Directional close capture; no dedicated denoiser verified | 4 | 4 | Practical legacy USB/XLR example; remaining retail stock and cable package need checking. |
| MIC-019 | Dynamic | Cardioid | USB mini-B; XLR | USB bus; interface in XLR mode | Included desk stand / windscreen / cables; optional boom | Directional close capture; no dedicated denoiser verified | 4 | 4 | Complete starter package for a desk demo; the older USB connector requires the correct cable. |
| MIC-020 | Dynamic | Cardioid | USB-C; XLR | USB bus; interface in XLR mode | Included base stand; interface only for XLR | Directional close capture; no dedicated denoiser verified | 4 | 4 | Low-cost dynamic desk option; keep it near the mouth and check stand height. |
| MIC-021 | Dynamic | Cardioid | USB-C; XLR | USB bus; interface in XLR mode | BA20 boom arm in selected variant; XLR interface optional | Close directional capture; Maono Link processing via USB | 4 | 4 | Budget boom-arm setup for keeping mouth-to-mic distance steady during prompting. |
| MIC-022 | Condenser | Cardioid | USB-C | USB bus | Included magnetic desk stand; optional boom | Directional pickup; integrated pop filter | 2 | 4 | Compact and simple for a quieter desk; head movement and distant placement can admit more room sound. |
| MIC-023 | Condenser | Cardioid | USB-C | USB bus | Included tripod / pop filter; optional boom | Directional pickup; APHEX processing | 2 | 4 | Useful voice-recording option at a desk; position close and check whether processing helps the dictation model. |
| MIC-024 | Condenser | Selectable cardioid / omni / bidirectional / stereo | USB mini-B | USB bus | Included desk stand; optional boom | Use cardioid mode; Blue VO!CE software filters | 2 | 4 | Familiar consumer desk option; select cardioid and avoid leaving it at the far edge of the desk. |
| MIC-025 | Condenser | Cardioid | USB mini-B | USB bus | Included desk tripod; optional boom | Directional pickup; no dedicated denoiser verified | 2 | 3 | Low-cost legacy consumer example for the catalog; modest positioning flexibility on the stock tripod. |
| MIC-026 | Condenser | Cardioid | USB-C | USB bus | Desk mount / optional boom; confirm selected package | Wave FX DSP; Clipguard; auto gain | 3 | 4 | Feature-rich desk setup for prompts and streaming; compare clean and processed input in your app. |
| MIC-027 | Condenser | Cardioid | USB-C | USB bus | Included adjustable stand; optional boom | Built-in pop filter / shock mount; software audio filters | 2 | 4 | Affordable consumer USB baseline with tap-to-mute; a busy café still calls for close placement. |
| MIC-028 | Condenser | Selectable cardioid / omni / bidirectional / stereo | USB-C | USB bus | Included stand / shock mount; optional boom | Use cardioid; vibration isolation; no dedicated denoiser verified | 2 | 4 | A visually recognizable demo product; use cardioid for one speaker and keep keyboard vibration low. |
| MIC-029 | Condenser | Supercardioid | USB | USB bus | Included desk stand; optional boom | Directional pickup; tap-to-mute | 3 | 4 | Small directional desk microphone for a portable kit; noise directly behind the mic can still matter. |
| MIC-030 | Dynamic | Cardioid | XLR | No phantom power required | XLR interface + cable + stand | Close directional pickup; built-in pop filtering | 4 | 5 | Rugged close-talk option if an audio interface is already part of the desk setup. |
| MIC-031 | Dynamic | Cardioid | XLR | No phantom power for mic itself | High-gain low-noise XLR interface + cable + boom; booster only if needed | Close directional capture; windscreen; analog tone switches | 4 | 5 | Premium fixed-desk example with substantial mounting and gain requirements. |
| MIC-032 | Dynamic | Cardioid | XLR | No phantom power required | XLR interface + cable + sturdy stand / boom | Close directional pickup; integrated pop shield | 4 | 5 | Budget professional desk mic when an interface is available; its weight favors a sturdy mount. |
| MIC-033 | Condenser | Cardioid | XLR | 48V phantom power | Phantom-powered XLR interface + cable + stand + pop filter | Directional capture; no dedicated denoiser verified | 2 | 4 | Useful studio comparison product; a noisy café is a difficult setting if the mic sits far away. |
| MIC-034 | Dynamic | Cardioid | XLR | No phantom power required | XLR interface + cable + stand | Close directional capture | 4 | 5 | An alternative handheld vocal mic for a fixed dictation rig; maintain a steady working distance. |
| MIC-035 | Condenser | Omnidirectional | 3.5mm TRRS with camera / phone mode | LR44 in applicable camera mode | Mic-capable USB / TRRS adapter if required | Close clothing placement; no verified active cancellation for Classic | 2 | 3 | Low-cost clip-on with a long cable; isolate it from fabric rubbing and nearby conversations. |
| MIC-036 | Condenser | Omnidirectional | 3.5mm TRRS | Plug-in power from compatible host | Mic-capable USB audio adapter; TRRS-to-TRS adapter for TRS inputs | Close clothing placement; pop filter | 2 | 3 | Simple phone-oriented lavalier for dictation; adapter compatibility is the main setup detail. |
| MIC-037 | Condenser | Omnidirectional | 3.5mm TRS | Plug-in power from compatible mic input | Compatible TRS mic input / wireless bodypack; adapter for TRRS or USB | Close clothing placement; pop shield | 2 | 3 | Discrete wired lavalier; the laptop must have a suitable powered mic input or adapter. |
| MIC-038 | Condenser | Omnidirectional | 2.4GHz TX-to-RX; USB-C / 3.5mm RX; Bluetooth to supported hosts | Rechargeable TX / RX | USB data cable for computer; Lightning adapter if required | Two-level active noise cancellation | 3 | 4 | Tiny portable clip-on candidate; compare receiver audio with direct Bluetooth before using it for prompts. |
| MIC-039 | Condenser | Omnidirectional | 2.4GHz TX-to-RX; USB-C / 3.5mm RX; Bluetooth to supported hosts | Rechargeable TX / RX | USB data cable for computer; matching phone adapter | Intelligent noise cancellation | 3 | 4 | Portable kit with monitoring and recording features; verify real-time USB input in the dictation app. |
| MIC-040 | Condenser | Omnidirectional | 2.4GHz TX-to-RX; USB-C / 3.5mm RX | Rechargeable TX / RX | Included cables; confirm host cable | Close clip-on capture; GainAssist level control | 3 | 4 | Easy portable option; disable or exclude receiver-side ME Mic when only the wearer should be transcribed. |
| MIC-041 | Condenser | Omnidirectional | 2.4GHz TX-to-RX; USB-C / 3.5mm RX | Rechargeable TX / RX | USB data cable; optional external lav | Close clip-on capture; no dedicated denoiser verified | 3 | 4 | Legacy wireless example for the demo; check remaining sellers for the exact single-TX kit. |
| MIC-042 | Condenser | Omnidirectional | 2.4GHz; USB-C / Lightning receiver options | Rechargeable TX / RX / case | Use matching included receiver; confirm exact Combo contents | Environmental noise cancellation | 3 | 4 | Small wearable option for mobile prompting; clothing placement still affects consistency. |
| MIC-043 | Condenser | Omnidirectional | 2.4GHz TX-to-RX; USB-C / Lightning / 3.5mm RX | Rechargeable TX / RX / case | Use matching output cable / adapter | Two-stage noise cancellation; low-cut filters | 3 | 4 | Versatile two-person kit; route a single speaker channel to avoid accidentally transcribing a second wearer. |
| MIC-044 | Condenser | Supercardioid shotgun | USB-C; 3.5mm TRS | USB bus or plug-in power | USB data cable + desk / boom mount for computer use | Directional pickup; isolation mount | 3 | 4 | Lightweight directional option; bring it close to the speaker instead of treating it as an across-room mic. |
| MIC-045 | Condenser | Supercardioid shotgun | USB-C; 3.5mm auto-sensing output | Internal rechargeable battery / USB | USB data cable + suitable desk / boom mount | Directional pickup; high-pass filter; gain controls | 3 | 4 | Flexible camera-and-computer mic; a close boom position is more useful than pointing from far away. |
| MIC-046 | Condenser | Supercardioid shotgun | 3.5mm TRS / TRRS via supplied cables | 2 AAA batteries | USB audio interface with mic input for USB-only laptops; mount | Directional pickup; low-cut filter; wind protection | 3 | 4 | Compact directional alternative; computer use needs an appropriate analog mic-input path. |
| MIC-047 | Condenser | Supercardioid | 3.5mm TRS; supplied TRRS host cable | 1–5V plug-in power | Mic-capable USB adapter for USB-only hosts; mount | Directional pickup; included windscreen | 3 | 4 | Low-cost directional demo option; ensure the adapter supplies microphone plug-in power. |
| MIC-048 | Electret condenser | Unidirectional | USB-A | USB bus | None for USB-A; USB-C adapter if required | Decoupled mic; pop filtering; speech-focused close capture | 4 | 5 | Purpose-built handheld dictation with programmable controls; less hands-free than a headset. |
| MIC-049 | Electret condenser | Unidirectional | Wireless headset to USB docking station | Rechargeable battery | USB docking station; optional AirBridge sold separately | Triple-layer noise-reduction filter; close boom | 5 | 5 | Professional hands-free dictation example; treat the listing as a legacy product rather than fresh purchasable stock. |
| MIC-050 | Dual microphone system | Directional modes / beamforming | USB | USB bus | USB-C adapter if required; configuration software for controls | Dual-mic noise cancellation; dictation mode selection | 4 | 5 | Specialist handheld option for controlled dictation workflows; check button mapping with the chosen prompting app. |


## Customer review data

Scores are out of 5. For Sweetwater, the count is the number of individually rated customer reviews rendered in the fetched review page; the star value is the page's displayed aggregate, not a calculated average. Counts and aggregates can change. Family-level / grouped ratings are labeled and must not be treated as independent model tests. `Not captured` means this research did not retrieve review content, not that no reviews exist.


| id | customer_rating_out_of_5 | customer_review_count | review_scope | inspected_customer_feedback | review_source |
| --- | --- | --- | --- | --- | --- |
| MIC-001 | 4.35 | 1038 | Target product aggregate; price / inventory may differ from Apple | Not captured. | [Reviews](https://www.target.com/p/-/A-89827259) |
| MIC-002 | null | null | Not captured | Not captured. | null |
| MIC-003 | null | null | Not captured | Not captured. | null |
| MIC-004 | null | null | Not captured | Not captured. | null |
| MIC-005 | null | null | Not captured | Not captured. | null |
| MIC-006 | null | null | Not captured | Not captured. | null |
| MIC-007 | null | null | Not captured | Not captured. | null |
| MIC-008 | 4.67 | 3 | Retailer product aggregate | Not captured. | [Reviews](https://www.headsetsdirect.com/product/jabra-evolve2-40-uc-stereo-usb-headset/) |
| MIC-009 | null | null | Not captured | Not captured. | null |
| MIC-010 | null | null | Not captured | Not captured. | null |
| MIC-011 | null | null | Not captured | Not captured. | null |
| MIC-012 | null | null | Not captured | Not captured. | null |
| MIC-013 | null | null | Not captured | Not captured. | null |
| MIC-014 | null | null | Not captured | Not captured. | null |
| MIC-015 | null | null | Not captured | Not captured. | null |
| MIC-016 | 4.2 | 6 | Rendered customer reviews | Visible reviews praise sound and setup; one reports microphone failure and another warns about USB-port durability. | [Reviews](https://www.sweetwater.com/store/detail/MV7pBK--shure-mv7-hybrid-podcast-microphone-black/reviews) |
| MIC-017 | 3.7 | 6 | Rendered customer reviews | Visible reviews praise plug-and-play voice sound; negative reviews report failures in onboard electronics. | [Reviews](https://www.sweetwater.com/store/detail/PodMicUSB--rode-podmic-usb-dynamic-broadcast-microphone/reviews) |
| MIC-018 | null | null | Not captured | Not captured. | null |
| MIC-019 | 4.5 | 13 | Rendered customer reviews | Visible reviews praise easy computer recognition and included accessories; one reports a nonfunctional unit on arrival. | [Reviews](https://www.sweetwater.com/store/detail/Q2UPack--samson-q2u-recording-and-podcasting-pack-usb-xlr-dynamic-microphone-with-accessories/reviews) |
| MIC-020 | 4.8 | 184 | Brand-store aggregate; variant grouping not independently established | Not captured. | [Reviews](https://fifinemicrophone.com/collections/microphones/products/fifine-ampligame-am8-microphone) |
| MIC-021 | null | null | Not captured | Not captured. | null |
| MIC-022 | 4.7 | 22 | Rendered customer reviews | Visible reviews praise clear sound, compact design, and the magnetic stand; some users report less satisfactory sound or gain. | [Reviews](https://www.sweetwater.com/store/detail/NTUSBMini--rode-nt-usb-mini-usb-condenser-microphone/reviews) |
| MIC-023 | 4.7 | 8 | Rendered customer reviews | Visible reviews praise easy setup and voice recording; one user describes the tone as muddy. | [Reviews](https://www.sweetwater.com/store/detail/NTUSBp--rode-nt-usb-usb-condenser-microphone/reviews) |
| MIC-024 | null | null | Not captured | Not captured. | null |
| MIC-025 | null | null | Not captured | Not captured. | null |
| MIC-026 | 4.8 | 187 | Family aggregate includes both Wave:3 generations; not MK.2-only | Not captured. | [Reviews](https://www.elgato.com/us/en/p/wave-3) |
| MIC-027 | null | null | Not captured | Not captured. | null |
| MIC-028 | null | null | Not captured | Not captured. | null |
| MIC-029 | null | null | Not captured | Not captured. | null |
| MIC-030 | 4.7 | 370 | Rendered customer reviews | Visible reviews repeatedly praise dependable vocal sound and rugged construction; they mainly concern music / live use. | [Reviews](https://www.sweetwater.com/store/detail/SM58--shure-sm58-cardioid-dynamic-vocal-microphone/reviews) |
| MIC-031 | 4.8 | 259 | Rendered customer reviews | Visible reviews praise voice tone and versatility; users discuss sufficient preamp gain and optional boosters. | [Reviews](https://www.sweetwater.com/store/detail/SM7B--shure-sm7b-cardioid-dynamic-vocal-microphone/reviews) |
| MIC-032 | 4.7 | 64 | Rendered customer reviews | Visible reviews praise solid construction and voice sound; several discuss high gain requirements. | [Reviews](https://www.sweetwater.com/store/detail/PodMic--rode-podmic-dynamic-broadcast-microphone/reviews) |
| MIC-033 | 4.6 | 109 | Rendered customer reviews | Visible reviews praise value and recording sound; some describe capturing a whole choir, illustrating that source distance matters. | [Reviews](https://www.sweetwater.com/store/detail/AT2020--audio-technica-at2020-cardioid-condenser-microphone/reviews) |
| MIC-034 | 4.7 | 195 | Rendered customer reviews | Visible reviews praise vocal clarity; some users describe a brighter tone than their familiar handheld alternatives. | [Reviews](https://www.sweetwater.com/store/detail/E835--sennheiser-e-835-cardioid-dynamic-vocal-microphone/reviews) |
| MIC-035 | null | null | Not captured | Not captured. | null |
| MIC-036 | null | 240 | Review count from indexed B&H product page; aggregate score not captured | Not captured. | [Reviews](https://www.bhphotovideo.com/c/product/1059342-REG/rode_smartlav_smart_lav_lav_mic_for.html) |
| MIC-037 | 5.0 | 7 | Rendered customer reviews | Visible reviews praise small size and voice sound; one notes self-noise and another warns about laptop combo-port compatibility. | [Reviews](https://www.sweetwater.com/store/detail/LavalierGO--rode-lavalier-go-professional-wearable-microphone/reviews) |
| MIC-038 | null | null | Not captured | Not captured. | null |
| MIC-039 | null | null | Not captured | Not captured. | null |
| MIC-040 | 4.8 | 4 | Rendered customer reviews | Visible reviews praise simple mobile setup; one reports relatively fast battery discharge. | [Reviews](https://www.sweetwater.com/store/detail/WirelessME--rode-wireless-me-clip-on-wireless-microphone-system/reviews) |
| MIC-041 | null | null | Not captured | Not captured. | null |
| MIC-042 | null | null | Not captured | Not captured. | null |
| MIC-043 | null | null | Not captured | Not captured. | null |
| MIC-044 | 5.0 | 2 | Rendered customer reviews | Two visible reviews praise audio and mounting; one explicitly says machinery noise was still captured. | [Reviews](https://www.sweetwater.com/store/detail/VideoMicGo2H--rode-videomic-go-ii-camera-mounted-shotgun-microphone/reviews) |
| MIC-045 | 4.8 | 11 | Rendered customer reviews | Visible reviews praise camera / computer versatility, battery operation, and spoken audio. | [Reviews](https://www.sweetwater.com/store/detail/VideoMicNTG--rode-videomic-ntg-camera-mount-shotgun-microphone/reviews) |
| MIC-046 | 4.3 | 2 | Rendered customer reviews | Two visible reviews praise voice presence, wind handling, and reduced room sound versus a camera mic. | [Reviews](https://www.sweetwater.com/store/detail/MKE400v2--sennheiser-mke400-supercardioid-condenser-on-camera-shotgun-microphone/reviews) |
| MIC-047 | null | 43 | Shop review count; aggregate score not exposed | Not captured. | [Reviews](https://shop.deitymic.com/products/d4-mini) |
| MIC-048 | null | null | Not captured | Not captured. | null |
| MIC-049 | null | null | Not captured | Not captured. | null |
| MIC-050 | null | 1 | Retailer review count; aggregate score not exposed | Not captured. | [Reviews](https://www.tvps.com/olympus-recmic-ii-rm-4010p-noise-canceling-push-button-dictation-microphone/ol-rm-4010p/) |


## Per-product evidence and variant notes


- **MIC-001 — EarPods (USB-C):** Price from Apple search result; stock and customer rating from Target, not Apple. Target lists a different price. Apple lists macOS Monterey 12.6+, iPadOS 16.4+, and iOS 17+ for the relevant USB-C devices.

- **MIC-002 — EarPods (3.5mm Headphone Plug):** Price from Apple search result; destination-specific inventory was not exposed.

- **MIC-003 — H390 (USB-A):** Current search result shows a sale price of $21.99 versus $24.99; page extraction returned a server error. USB-C is a separate selectable variant.

- **MIC-004 — H540:** Page explicitly said low stock; delivery destination was not selected.

- **MIC-005 — Zone Wired (Teams, Graphite):** Search result displayed new offers from $99.99 to $127.44. Recorded price is the range floor, not a verified single-seller offer. Manufacturer source: [Additional source](https://www.logitech.com/content/dam/logitech/en_us/video-collaboration/pdf/zone-wired-uc-datasheet.pdf)

- **MIC-006 — Zone Vibe 100 (Graphite):** Listed sale price $79.99 versus $99.99; no USB receiver assumed.

- **MIC-007 — Evolve 20 UC Stereo (4999-829-289-01):** Price fetched from page; in-stock wording was visible in search results only. Do not confuse with older USB-A-only Evolve 20 SKUs.

- **MIC-008 — Evolve2 40 SE UC Stereo:** Retailer page offers UC and Teams versions. The page says same-day shipping on in-stock items; that conditional wording does not prove this SKU is in stock.

- **MIC-009 — Evolve2 65 Flex Link380a UC Stereo:** Search result shows $277 versus $378. Fetched Lenovo page did not expose price or stock. Manufacturer specifications: [Additional source](https://www.jabra.com/_/media/Jabra_VXi_Product-Documentation/Jabra-Evolve2-65-Flex/Technical-specifications/RevA/EN-Jabra-Evolve2-65-Flex-Tech-Spec-24042023.pdf)

- **MIC-010 — Blackwire 3220 (8X228AA):** CDW quick specifications say omnidirectional, while the product family is marketed for noise-canceling voice capture. Pattern is left unresolved rather than relabeled cardioid. HP source: [Additional source](https://www.hp.com/us-en/shop/pdp/poly-blackwire-3220-stereo-usb-c-headset-usb-c-a-adapter)

- **MIC-011 — Blackwire 5220 (8X231AA):** CDW pattern field is unresolved against manufacturer noise-canceling claims. Manufacturer source: [Additional source](https://www.hp.com/us-en/poly/headsets/usb-headsets/blackwire-5200.html)

- **MIC-012 — Voyager Focus 2 UC (9T9J3AA#AC3):** Price applies to the listed UC adapter package; a charging stand is not assumed. Manufacturer source: [Additional source](https://www.hp.com/us-en/poly/headsets/bluetooth-headsets-and-earbuds/voyager-focus-2.html)

- **MIC-013 — Voyager 5200 UC USB-A + BT700:** Search result price applies to the UC kit with BT700, not the cheaper standalone mobile headset; extracted page did not expose price or inventory.

- **MIC-014 — WH20XLR:** B&H search result reports $99 and in stock. This is the XLR version, not TA4F for a wireless bodypack. Manufacturer guide: [Additional source](https://www.shure.com/en-US/docs/guide/WH20)

- **MIC-015 — MV6 Gen 2 (Black):** Original MV6 URL redirected to Gen 2. Recorded model and price follow the final page; no original-MV6 reviews transferred.

- **MIC-016 — MV7+ (Black):** New standalone mic price; open-box units and bundles excluded. USB processing is not assumed on the analog XLR path.

- **MIC-017 — PodMic USB:** Page price supersedes an older indexed $190 result. No desktop stand bundle assumed.

- **MIC-018 — ATR2100x-USB:** Manufacturer explicitly marks discontinued. $99.99 is a synthetic demo reference, not a retrieved offer.

- **MIC-019 — Q2U Recording and Podcasting Pack:** Price is for the listed accessories pack. USB mini-B should not be confused with USB-C on competing models; manufacturer source: [Additional source](https://samsontech.com/products/microphones/usb-microphones/q2u/)

- **MIC-020 — AmpliGame AM8 (base stand + USB cable):** Price is AM8 base package, not AM8T boom kit or AM8PLUS. A generic back-in-stock widget does not establish current stock.

- **MIC-021 — PD200X + BA20 boom arm:** Fetched variant reads PD200X [BA20 Boom Arm]. Do not transfer the price or wireless capability from adjacent PD200W variants.

- **MIC-022 — NT-USB Mini:** Live page reports $109 in stock, superseding an indexed backorder result.

- **MIC-023 — NT-USB+:** Product search result shows $179; another review-page result showed $169. Product fetch exposed financing text only, so price is a search snapshot with unresolved freshness.

- **MIC-024 — Yeti (Blackout):** Sale price $109.99 versus $139.99; this is the Yeti, not Yeti 2 or Yeti Nano.

- **MIC-025 — Snowball iCE (Black):** Official page lists $49.99 and Not available; this is the iCE, not the multipattern Snowball.

- **MIC-026 — Wave:3 MK.2:** URL now shows MK.2. Displayed rating includes reviews from both Wave:3 generations and is not a MK.2-only score.

- **MIC-027 — SoloCast 2:** Displayed sale price $44.99 versus $59.99; additional coupon excluded. Current model is SoloCast 2, not original SoloCast.

- **MIC-028 — QuadCast S (Black):** Displayed sale price $99.99 versus $119.99; QuadCast 2 S is a different model.

- **MIC-029 — Seiren V3 Mini (Black):** Manufacturer says starting from US$59.99; selected-color checkout price and inventory not verified.

- **MIC-030 — SM58:** Mic-only SM58; SM58S switch version and cable bundles cost differently.

- **MIC-031 — SM7B:** Mic-only price; total working setup costs more. An inline booster is not universally necessary and may itself need phantom power.

- **MIC-032 — PodMic (XLR, Black):** This XLR-only model does not provide PodMic USB features or USB DSP.

- **MIC-033 — AT2020 (XLR):** XLR AT2020, not AT2020USB-X; interface and pop filter are excluded from the listed price.

- **MIC-034 — e 835:** Single e 835 without switch; e 835-S and multipacks are separate offers.

- **MIC-035 — BY-M1 Classic:** Classic variant is $32.99; the page mixes BY-M1S / Pro II / adapters and some feature claims. Do not assign Pro II monitoring features to Classic. Stock claim comes from the product page.

- **MIC-036 — smartLav+:** Synthetic $79.99 demo reference; manufacturer page exposed no price. B&H search result lists 240 reviews, but no aggregate star rating was captured.

- **MIC-037 — Lavalier GO (Black):** Mic-only accessory. It is not itself wireless, and its TRS plug is not the same as smartLav+ TRRS.

- **MIC-038 — Mic Mini (1 TX + 1 RX):** Search result explicitly maps $59 to 1 TX + 1 RX. Fetched page defaults to $99 two-TX kit; all options were marked out of stock. No charging case assumed in the $59 kit.

- **MIC-039 — Mic 2 (1 TX + 1 RX):** Single-transmitter kit at $129; charging case not assumed. 32-bit float internal recording is not a promise about the live dictation audio path.

- **MIC-040 — Wireless ME (single TX kit):** One transmitter plus receiver; receiver also has a mic. GainAssist is automatic level control, not equivalent to background-noise cancellation.

- **MIC-041 — Wireless GO II Single:** Sweetwater says no longer available. $199 is a synthetic demo reference, not a current offer. Do not confuse with dual-transmitter GO II or later Wireless GO generations.

- **MIC-042 — LARK M2 Combo (Black):** Combo option shows $99 versus $183. Page default is a different $79.20 Mini Combo. Combo description says USB-C RX + Lightning RX + charging case; do not infer camera receiver inclusion from the family name.

- **MIC-043 — Blink 500 B2+ (2-person kit):** Product identity and specifications verified; $129 is a synthetic demo price because the fetched official listing exposed no price. BLINK500B2+ is distinct from ProX and older B2.

- **MIC-044 — VideoMic GO II with Helix mount:** Price is the listed Helix-mount package; USB cable / desktop mount requirements depend on package.

- **MIC-045 — VideoMic NTG:** New standalone price; open-box units excluded. A shotgun does not eliminate reflections or off-axis café speech.

- **MIC-046 — MKE 400 (2nd generation):** This model has no direct USB audio output; USB-only laptops require an adapter or interface.

- **MIC-047 — V-Mic D4 Mini:** Official shop lists $49.95 in stock and 43 reviews. No aggregate star rating was exposed; a histogram was not converted into an official score.

- **MIC-048 — SpeechMike Premium LFH3500:** Exact LFH3500 push-button RRP is $399. LFH3510 slide-switch RRP is $409. RRP is not a current retailer offer; button integrations may be limited on macOS or unsupported apps.

- **MIC-049 — SpeechOne PSM6300 kit (PSM6000 family):** Page explicitly names PSM6300 and says discontinued June 26, 2026. It contains $492 and $429 legacy amounts; $492 is the headline reference only, not a live quote. Manufacturer also says no longer available: [Additional source](https://www.dictation.philips.com/us/products/desktop-dictation/speechone-wireless-dictation-headset-psm6000/)

- **MIC-050 — RecMic II RM-4010P:** Retailer shows $349.99 and one review; stock is not exposed. Manufacturer support: [Additional source](https://audiosupport.omsystem.com/en/product/rm-4010p/)


## Suggested demo filters and test flow

- **Budget and connection:** Filter reference price and `price_kind`, then distinguish USB-ready equipment from XLR setups requiring an interface. Do not present an estimated price as a live deal.
- **Noisy café persona:** Compare a boom headset, a close USB dynamic mic, a wireless clip-on, a directional shotgun, and EarPods using the same voice passage and placement constraints.
- **Office persona:** Compare comfort, hands-free use, mute controls, USB / Bluetooth path, and ability to keep a steady mouth-to-mic distance.
- **Availability handling:** Show discontinued and out-of-stock entries as separate demo states. Synthetic fit scores are retained for those records to exercise ranking and stock-filter behavior.
- **Evaluation:** Record the same technical prompt on each candidate, including code identifiers, punctuation commands, and acronyms. Compare recognition errors, cut-off words, background-speech leakage, connection reliability, and user effort in the actual dictation app. These measurements are not included in this dataset.

## Import conventions

Use `id` as the stable key across tables. `reference_price_usd` is a decimal number. Review scores / counts are nullable numeric fields. Preserve `price_kind`, `availability`, `review_scope`, source URLs, and the shared `checked_on = 2026-10-24` when importing. The two `demo_*_fit` values are synthetic integers, while customer ratings are observed values. Do not substitute a demo fit score for a missing customer rating.

