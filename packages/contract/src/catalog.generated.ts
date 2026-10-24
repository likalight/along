// Generated from catalog/data/catalog.json by scripts/sync-catalog.mjs. Do not hand edit.
export const agreedCatalog: any = {
  "version": "1.0.0",
  "currency": "USD",
  "checkedOn": "2026-10-24",
  "scenarioNow": "2026-10-24T10:00:00+08:00",
  "timezone": "Asia/Singapore",
  "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
  "products": [
    {
      "id": "MIC-001",
      "category": "audio-accessories",
      "brand": "Apple",
      "model": "EarPods (USB-C)",
      "variantId": "MIC-001-DEMO",
      "title": "Apple EarPods (USB-C)",
      "checkedOn": "2026-10-24",
      "image": {
        "url": "/catalog/images/audio.svg",
        "alt": "Generic demo audio illustration, not a photograph of this model",
        "source": "Authored demo illustration",
        "classification": "proxy"
      },
      "specs": {
        "capsule / mic system": "Unspecified",
        "polar_pattern": "Unspecified",
        "connection": "USB-C",
        "power": "USB bus",
        "additional_hardware": "None with compatible USB-C host",
        "noise_strategy": "Inline microphone; no dedicated mic noise suppression verified",
        "sourceVariant": "EarPods (USB-C)",
        "compatibilityFixture": {
          "supportedHostConnections": [
            "usb-c"
          ],
          "requiredHardwareIds": []
        }
      },
      "limitations": [
        "No measured café-dictation performance evidence.",
        "None with compatible USB-C host",
        "Compatibility paths are bounded demo fixtures; other paths are unknown."
      ],
      "evidenceIds": [
        "SRC-MIC-001",
        "FIT-MIC-001",
        "COMPAT-MIC-001",
        "REV-MIC-001"
      ],
      "sourceUrls": [
        "https://www.apple.com/shop/product/myqy3am/a/earpods-usb-c",
        "https://www.target.com/p/-/A-89827259"
      ],
      "referencePrice": {
        "currency": "USD",
        "amountMinor": 1900,
        "price_kind": "search_snapshot",
        "payableTotalMinor": null
      },
      "sourceAvailability": "in_stock",
      "buyerMetrics": {
        "rating": 4.35,
        "ratingCount": null,
        "writtenReviewCount": null,
        "purchaseCount": null,
        "purchaseCountPeriod": null,
        "reviewScope": "Target product aggregate; price / inventory may differ from Apple"
      },
      "authoredFit": {
        "demo_cafe_fit": 2,
        "demo_office_fit": 3,
        "assessment": "Low-cost baseline for a laptop bag; keep the inline mic clear of clothing. Nearby speech can still interfere.",
        "measuredPerformance": false
      },
      "video": {
        "status": "missing",
        "reason": "No permission-verified playable product video/excerpt was curated for this fixture."
      }
    },
    {
      "id": "MIC-003",
      "category": "audio-accessories",
      "brand": "Logitech",
      "model": "H390 (USB-A)",
      "variantId": "MIC-003-DEMO",
      "title": "Logitech H390 (USB-A)",
      "checkedOn": "2026-10-24",
      "image": {
        "url": "/catalog/images/audio.svg",
        "alt": "Generic demo audio illustration, not a photograph of this model",
        "source": "Authored demo illustration",
        "classification": "proxy"
      },
      "specs": {
        "capsule / mic system": "Unspecified headset mic",
        "polar_pattern": "Unspecified",
        "connection": "USB-A",
        "power": "USB bus",
        "additional_hardware": "USB-C adapter if required",
        "noise_strategy": "Noise-canceling boom microphone",
        "sourceVariant": "H390 (USB-A)",
        "compatibilityFixture": {
          "supportedHostConnections": [
            "usb-a"
          ],
          "requiredHardwareIds": []
        }
      },
      "limitations": [
        "No measured café-dictation performance evidence.",
        "USB-C adapter if required",
        "Compatibility paths are bounded demo fixtures; other paths are unknown."
      ],
      "evidenceIds": [
        "SRC-MIC-003",
        "FIT-MIC-003",
        "COMPAT-MIC-003"
      ],
      "sourceUrls": [
        "https://www.logitech.com/en-us/shop/p/h390-usb-headset"
      ],
      "referencePrice": {
        "currency": "USD",
        "amountMinor": 2199,
        "price_kind": "search_snapshot",
        "payableTotalMinor": null
      },
      "sourceAvailability": "unknown",
      "buyerMetrics": {
        "rating": null,
        "ratingCount": null,
        "writtenReviewCount": null,
        "purchaseCount": null,
        "purchaseCountPeriod": null,
        "reviewScope": "Not captured"
      },
      "authoredFit": {
        "demo_cafe_fit": 4,
        "demo_office_fit": 4,
        "assessment": "Useful budget starting point: the boom keeps speech close while leaving both hands free.",
        "measuredPerformance": false
      },
      "video": {
        "status": "missing",
        "reason": "No permission-verified playable product video/excerpt was curated for this fixture."
      }
    },
    {
      "id": "MIC-009",
      "category": "audio-accessories",
      "brand": "Jabra",
      "model": "Evolve2 65 Flex Link380a UC Stereo",
      "variantId": "MIC-009-DEMO",
      "title": "Jabra Evolve2 65 Flex Link380a UC Stereo",
      "checkedOn": "2026-10-24",
      "image": {
        "url": "/catalog/images/audio.svg",
        "alt": "Generic demo audio illustration, not a photograph of this model",
        "source": "Authored demo illustration",
        "classification": "proxy"
      },
      "specs": {
        "capsule / mic system": "Multi-microphone system",
        "polar_pattern": "Beamforming / unspecified physical pattern",
        "connection": "Bluetooth; Link380a USB-A receiver",
        "power": "Rechargeable battery",
        "additional_hardware": "USB-C adapter for receiver if needed",
        "noise_strategy": "ClearVoice microphone processing; headphone ANC is separate",
        "sourceVariant": "Evolve2 65 Flex Link380a UC Stereo",
        "compatibilityFixture": {
          "supportedHostConnections": [
            "usb-a"
          ],
          "requiredHardwareIds": []
        }
      },
      "limitations": [
        "No measured café-dictation performance evidence.",
        "USB-C adapter for receiver if needed",
        "Compatibility paths are bounded demo fixtures; other paths are unknown."
      ],
      "evidenceIds": [
        "SRC-MIC-009",
        "FIT-MIC-009",
        "COMPAT-MIC-009"
      ],
      "sourceUrls": [
        "https://www.lenovo.com/us/en/p/accessories-and-software/audio/headsets/78806811"
      ],
      "referencePrice": {
        "currency": "USD",
        "amountMinor": 27700,
        "price_kind": "search_snapshot",
        "payableTotalMinor": null
      },
      "sourceAvailability": "unknown",
      "buyerMetrics": {
        "rating": null,
        "ratingCount": null,
        "writtenReviewCount": null,
        "purchaseCount": null,
        "purchaseCountPeriod": null,
        "reviewScope": "Not captured"
      },
      "authoredFit": {
        "demo_cafe_fit": 5,
        "demo_office_fit": 5,
        "assessment": "Portable premium headset candidate for café prompting; keep the boom correctly positioned.",
        "measuredPerformance": false
      },
      "video": {
        "status": "missing",
        "reason": "No permission-verified playable product video/excerpt was curated for this fixture."
      }
    },
    {
      "id": "MIC-015",
      "category": "audio-accessories",
      "brand": "Shure",
      "model": "MV6 Gen 2 (Black)",
      "variantId": "MIC-015-DEMO",
      "title": "Shure MV6 Gen 2 (Black)",
      "checkedOn": "2026-10-24",
      "image": {
        "url": "/catalog/images/audio.svg",
        "alt": "Generic demo audio illustration, not a photograph of this model",
        "source": "Authored demo illustration",
        "classification": "proxy"
      },
      "specs": {
        "capsule / mic system": "Dynamic",
        "polar_pattern": "Cardioid",
        "connection": "USB-C",
        "power": "USB bus",
        "additional_hardware": "Included desk stand; optional boom arm",
        "noise_strategy": "Directional pickup; denoiser; auto level; pop suppression",
        "sourceVariant": "MV6 Gen 2 (Black)",
        "compatibilityFixture": {
          "supportedHostConnections": [
            "usb-c"
          ],
          "requiredHardwareIds": []
        }
      },
      "limitations": [
        "No measured café-dictation performance evidence.",
        "Included desk stand; optional boom arm",
        "Compatibility paths are bounded demo fixtures; other paths are unknown."
      ],
      "evidenceIds": [
        "SRC-MIC-015",
        "FIT-MIC-015",
        "COMPAT-MIC-015"
      ],
      "sourceUrls": [
        "https://www.sweetwater.com/store/detail/MV6G2K--shure-mv6-gen-2-usb-gaming-microphone-black"
      ],
      "referencePrice": {
        "currency": "USD",
        "amountMinor": 16900,
        "price_kind": "observed_page",
        "payableTotalMinor": null
      },
      "sourceAvailability": "in_stock",
      "buyerMetrics": {
        "rating": null,
        "ratingCount": null,
        "writtenReviewCount": null,
        "purchaseCount": null,
        "purchaseCountPeriod": null,
        "reviewScope": "Not captured"
      },
      "authoredFit": {
        "demo_cafe_fit": 4,
        "demo_office_fit": 5,
        "assessment": "Easy USB desk candidate for prompting; place it close enough that the voice dominates the café.",
        "measuredPerformance": false
      },
      "video": {
        "status": "missing",
        "reason": "No permission-verified playable product video/excerpt was curated for this fixture."
      }
    },
    {
      "id": "MIC-020",
      "category": "audio-accessories",
      "brand": "FIFINE",
      "model": "AmpliGame AM8 (base stand + USB cable)",
      "variantId": "MIC-020-DEMO",
      "title": "FIFINE AmpliGame AM8 (base stand + USB cable)",
      "checkedOn": "2026-10-24",
      "image": {
        "url": "/catalog/images/audio.svg",
        "alt": "Generic demo audio illustration, not a photograph of this model",
        "source": "Authored demo illustration",
        "classification": "proxy"
      },
      "specs": {
        "capsule / mic system": "Dynamic",
        "polar_pattern": "Cardioid",
        "connection": "USB-C; XLR",
        "power": "USB bus; interface in XLR mode",
        "additional_hardware": "Included base stand; interface only for XLR",
        "noise_strategy": "Directional close capture; no dedicated denoiser verified",
        "sourceVariant": "AmpliGame AM8 (base stand + USB cable)",
        "compatibilityFixture": {
          "supportedHostConnections": [
            "usb-a"
          ],
          "requiredHardwareIds": [
            "usb-a-to-c-data-cable"
          ]
        }
      },
      "limitations": [
        "No measured café-dictation performance evidence.",
        "Included base stand; interface only for XLR",
        "Compatibility paths are bounded demo fixtures; other paths are unknown."
      ],
      "evidenceIds": [
        "SRC-MIC-020",
        "FIT-MIC-020",
        "COMPAT-MIC-020",
        "REV-MIC-020"
      ],
      "sourceUrls": [
        "https://fifinemicrophone.com/collections/microphones/products/fifine-ampligame-am8-microphone",
        "https://fifinemicrophone.com/collections/microphones/products/fifine-ampligame-am8-microphone"
      ],
      "referencePrice": {
        "currency": "USD",
        "amountMinor": 5799,
        "price_kind": "observed_page",
        "payableTotalMinor": null
      },
      "sourceAvailability": "unknown",
      "buyerMetrics": {
        "rating": 4.8,
        "ratingCount": null,
        "writtenReviewCount": null,
        "purchaseCount": null,
        "purchaseCountPeriod": null,
        "reviewScope": "Brand-store aggregate; variant grouping not independently established"
      },
      "authoredFit": {
        "demo_cafe_fit": 4,
        "demo_office_fit": 4,
        "assessment": "Low-cost dynamic desk option; keep it near the mouth and check stand height.",
        "measuredPerformance": false
      },
      "video": {
        "status": "missing",
        "reason": "No permission-verified playable product video/excerpt was curated for this fixture."
      }
    },
    {
      "id": "MIC-022",
      "category": "audio-accessories",
      "brand": "RØDE",
      "model": "NT-USB Mini",
      "variantId": "MIC-022-DEMO",
      "title": "RØDE NT-USB Mini",
      "checkedOn": "2026-10-24",
      "image": {
        "url": "/catalog/images/audio.svg",
        "alt": "Generic demo audio illustration, not a photograph of this model",
        "source": "Authored demo illustration",
        "classification": "proxy"
      },
      "specs": {
        "capsule / mic system": "Condenser",
        "polar_pattern": "Cardioid",
        "connection": "USB-C",
        "power": "USB bus",
        "additional_hardware": "Included magnetic desk stand; optional boom",
        "noise_strategy": "Directional pickup; integrated pop filter",
        "sourceVariant": "NT-USB Mini",
        "compatibilityFixture": {
          "supportedHostConnections": [
            "usb-a"
          ],
          "requiredHardwareIds": [
            "usb-a-to-c-data-cable"
          ]
        }
      },
      "limitations": [
        "No measured café-dictation performance evidence.",
        "Included magnetic desk stand; optional boom",
        "Compatibility paths are bounded demo fixtures; other paths are unknown."
      ],
      "evidenceIds": [
        "SRC-MIC-022",
        "FIT-MIC-022",
        "COMPAT-MIC-022",
        "REV-MIC-022"
      ],
      "sourceUrls": [
        "https://www.sweetwater.com/store/detail/NTUSBMini--rode-nt-usb-mini-usb-condenser-microphone",
        "https://www.sweetwater.com/store/detail/NTUSBMini--rode-nt-usb-mini-usb-condenser-microphone/reviews"
      ],
      "referencePrice": {
        "currency": "USD",
        "amountMinor": 10900,
        "price_kind": "observed_page",
        "payableTotalMinor": null
      },
      "sourceAvailability": "in_stock",
      "buyerMetrics": {
        "rating": 4.7,
        "ratingCount": 22,
        "writtenReviewCount": 22,
        "purchaseCount": null,
        "purchaseCountPeriod": null,
        "reviewScope": "Rendered customer reviews"
      },
      "authoredFit": {
        "demo_cafe_fit": 2,
        "demo_office_fit": 4,
        "assessment": "Compact and simple for a quieter desk; head movement and distant placement can admit more room sound.",
        "measuredPerformance": false
      },
      "video": {
        "status": "missing",
        "reason": "No permission-verified playable product video/excerpt was curated for this fixture."
      }
    },
    {
      "id": "MIC-025",
      "category": "audio-accessories",
      "brand": "Logitech / Blue",
      "model": "Snowball iCE (Black)",
      "variantId": "MIC-025-DEMO",
      "title": "Logitech / Blue Snowball iCE (Black)",
      "checkedOn": "2026-10-24",
      "image": {
        "url": "/catalog/images/audio.svg",
        "alt": "Generic demo audio illustration, not a photograph of this model",
        "source": "Authored demo illustration",
        "classification": "proxy"
      },
      "specs": {
        "capsule / mic system": "Condenser",
        "polar_pattern": "Cardioid",
        "connection": "USB mini-B",
        "power": "USB bus",
        "additional_hardware": "Included desk tripod; optional boom",
        "noise_strategy": "Directional pickup; no dedicated denoiser verified",
        "sourceVariant": "Snowball iCE (Black)",
        "compatibilityFixture": {
          "supportedHostConnections": [
            "usb-a"
          ],
          "requiredHardwareIds": []
        }
      },
      "limitations": [
        "No measured café-dictation performance evidence.",
        "Included desk tripod; optional boom",
        "Compatibility paths are bounded demo fixtures; other paths are unknown."
      ],
      "evidenceIds": [
        "SRC-MIC-025",
        "FIT-MIC-025",
        "COMPAT-MIC-025"
      ],
      "sourceUrls": [
        "https://www.logitechg.com/en-us/shop/p/snowball-ice-usb-microphone"
      ],
      "referencePrice": {
        "currency": "USD",
        "amountMinor": 4999,
        "price_kind": "observed_page",
        "payableTotalMinor": null
      },
      "sourceAvailability": "unavailable",
      "buyerMetrics": {
        "rating": null,
        "ratingCount": null,
        "writtenReviewCount": null,
        "purchaseCount": null,
        "purchaseCountPeriod": null,
        "reviewScope": "Not captured"
      },
      "authoredFit": {
        "demo_cafe_fit": 2,
        "demo_office_fit": 3,
        "assessment": "Low-cost legacy consumer example for the catalog; modest positioning flexibility on the stock tripod.",
        "measuredPerformance": false
      },
      "video": {
        "status": "missing",
        "reason": "No permission-verified playable product video/excerpt was curated for this fixture."
      }
    },
    {
      "id": "MIC-037",
      "category": "audio-accessories",
      "brand": "RØDE",
      "model": "Lavalier GO (Black)",
      "variantId": "MIC-037-DEMO",
      "title": "RØDE Lavalier GO (Black)",
      "checkedOn": "2026-10-24",
      "image": {
        "url": "/catalog/images/audio.svg",
        "alt": "Generic demo audio illustration, not a photograph of this model",
        "source": "Authored demo illustration",
        "classification": "proxy"
      },
      "specs": {
        "capsule / mic system": "Condenser",
        "polar_pattern": "Omnidirectional",
        "connection": "3.5mm TRS",
        "power": "Plug-in power from compatible mic input",
        "additional_hardware": "Compatible TRS mic input / wireless bodypack; adapter for TRRS or USB",
        "noise_strategy": "Close clothing placement; pop shield",
        "sourceVariant": "Lavalier GO (Black)",
        "compatibilityFixture": {
          "supportedHostConnections": [
            "usb-c"
          ],
          "requiredHardwareIds": [
            "usb-c-trs-mic-interface"
          ]
        }
      },
      "limitations": [
        "No measured café-dictation performance evidence.",
        "Compatible TRS mic input / wireless bodypack; adapter for TRRS or USB",
        "Compatibility paths are bounded demo fixtures; other paths are unknown."
      ],
      "evidenceIds": [
        "SRC-MIC-037",
        "FIT-MIC-037",
        "COMPAT-MIC-037",
        "REV-MIC-037"
      ],
      "sourceUrls": [
        "https://www.sweetwater.com/store/detail/LavalierGO--rode-lavalier-go-professional-wearable-microphone",
        "https://www.sweetwater.com/store/detail/LavalierGO--rode-lavalier-go-professional-wearable-microphone/reviews"
      ],
      "referencePrice": {
        "currency": "USD",
        "amountMinor": 8900,
        "price_kind": "observed_page",
        "payableTotalMinor": null
      },
      "sourceAvailability": "in_stock",
      "buyerMetrics": {
        "rating": 5,
        "ratingCount": 7,
        "writtenReviewCount": 7,
        "purchaseCount": null,
        "purchaseCountPeriod": null,
        "reviewScope": "Rendered customer reviews"
      },
      "authoredFit": {
        "demo_cafe_fit": 2,
        "demo_office_fit": 3,
        "assessment": "Discrete wired lavalier; the laptop must have a suitable powered mic input or adapter.",
        "measuredPerformance": false
      },
      "video": {
        "status": "missing",
        "reason": "No permission-verified playable product video/excerpt was curated for this fixture."
      }
    },
    {
      "id": "MIC-038",
      "category": "audio-accessories",
      "brand": "DJI",
      "model": "Mic Mini (1 TX + 1 RX)",
      "variantId": "MIC-038-DEMO",
      "title": "DJI Mic Mini (1 TX + 1 RX)",
      "checkedOn": "2026-10-24",
      "image": {
        "url": "/catalog/images/audio.svg",
        "alt": "Generic demo audio illustration, not a photograph of this model",
        "source": "Authored demo illustration",
        "classification": "proxy"
      },
      "specs": {
        "capsule / mic system": "Condenser",
        "polar_pattern": "Omnidirectional",
        "connection": "2.4GHz TX-to-RX; USB-C / 3.5mm RX; Bluetooth to supported hosts",
        "power": "Rechargeable TX / RX",
        "additional_hardware": "USB data cable for computer; Lightning adapter if required",
        "noise_strategy": "Two-level active noise cancellation",
        "sourceVariant": "Mic Mini (1 TX + 1 RX)",
        "compatibilityFixture": {
          "supportedHostConnections": [
            "usb-c"
          ],
          "requiredHardwareIds": []
        }
      },
      "limitations": [
        "No measured café-dictation performance evidence.",
        "USB data cable for computer; Lightning adapter if required",
        "Compatibility paths are bounded demo fixtures; other paths are unknown."
      ],
      "evidenceIds": [
        "SRC-MIC-038",
        "FIT-MIC-038",
        "COMPAT-MIC-038"
      ],
      "sourceUrls": [
        "https://store.dji.com/product/dji-mic-mini"
      ],
      "referencePrice": {
        "currency": "USD",
        "amountMinor": 5900,
        "price_kind": "search_snapshot",
        "payableTotalMinor": null
      },
      "sourceAvailability": "out_of_stock",
      "buyerMetrics": {
        "rating": null,
        "ratingCount": null,
        "writtenReviewCount": null,
        "purchaseCount": null,
        "purchaseCountPeriod": null,
        "reviewScope": "Not captured"
      },
      "authoredFit": {
        "demo_cafe_fit": 3,
        "demo_office_fit": 4,
        "assessment": "Tiny portable clip-on candidate; compare receiver audio with direct Bluetooth before using it for prompts.",
        "measuredPerformance": false
      },
      "video": {
        "status": "missing",
        "reason": "No permission-verified playable product video/excerpt was curated for this fixture."
      }
    },
    {
      "id": "MIC-040",
      "category": "audio-accessories",
      "brand": "RØDE",
      "model": "Wireless ME (single TX kit)",
      "variantId": "MIC-040-DEMO",
      "title": "RØDE Wireless ME (single TX kit)",
      "checkedOn": "2026-10-24",
      "image": {
        "url": "/catalog/images/audio.svg",
        "alt": "Generic demo audio illustration, not a photograph of this model",
        "source": "Authored demo illustration",
        "classification": "proxy"
      },
      "specs": {
        "capsule / mic system": "Condenser",
        "polar_pattern": "Omnidirectional",
        "connection": "2.4GHz TX-to-RX; USB-C / 3.5mm RX",
        "power": "Rechargeable TX / RX",
        "additional_hardware": "Included cables; confirm host cable",
        "noise_strategy": "Close clip-on capture; GainAssist level control",
        "sourceVariant": "Wireless ME (single TX kit)",
        "compatibilityFixture": {
          "supportedHostConnections": [
            "usb-c"
          ],
          "requiredHardwareIds": [
            "usb-c-data-cable"
          ]
        }
      },
      "limitations": [
        "No measured café-dictation performance evidence.",
        "Included cables; confirm host cable",
        "Compatibility paths are bounded demo fixtures; other paths are unknown."
      ],
      "evidenceIds": [
        "SRC-MIC-040",
        "FIT-MIC-040",
        "COMPAT-MIC-040",
        "REV-MIC-040"
      ],
      "sourceUrls": [
        "https://www.sweetwater.com/store/detail/WirelessME--rode-wireless-me-clip-on-wireless-microphone-system",
        "https://www.sweetwater.com/store/detail/WirelessME--rode-wireless-me-clip-on-wireless-microphone-system/reviews"
      ],
      "referencePrice": {
        "currency": "USD",
        "amountMinor": 14900,
        "price_kind": "observed_page",
        "payableTotalMinor": null
      },
      "sourceAvailability": "in_stock",
      "buyerMetrics": {
        "rating": 4.8,
        "ratingCount": 4,
        "writtenReviewCount": 4,
        "purchaseCount": null,
        "purchaseCountPeriod": null,
        "reviewScope": "Rendered customer reviews"
      },
      "authoredFit": {
        "demo_cafe_fit": 3,
        "demo_office_fit": 4,
        "assessment": "Easy portable option; disable or exclude receiver-side ME Mic when only the wearer should be transcribed.",
        "measuredPerformance": false
      },
      "video": {
        "status": "missing",
        "reason": "No permission-verified playable product video/excerpt was curated for this fixture."
      }
    },
    {
      "id": "MIC-044",
      "category": "audio-accessories",
      "brand": "RØDE",
      "model": "VideoMic GO II with Helix mount",
      "variantId": "MIC-044-DEMO",
      "title": "RØDE VideoMic GO II with Helix mount",
      "checkedOn": "2026-10-24",
      "image": {
        "url": "/catalog/images/audio.svg",
        "alt": "Generic demo audio illustration, not a photograph of this model",
        "source": "Authored demo illustration",
        "classification": "proxy"
      },
      "specs": {
        "capsule / mic system": "Condenser",
        "polar_pattern": "Supercardioid shotgun",
        "connection": "USB-C; 3.5mm TRS",
        "power": "USB bus or plug-in power",
        "additional_hardware": "USB data cable + desk / boom mount for computer use",
        "noise_strategy": "Directional pickup; isolation mount",
        "sourceVariant": "VideoMic GO II with Helix mount",
        "compatibilityFixture": {
          "supportedHostConnections": [
            "usb-c"
          ],
          "requiredHardwareIds": [
            "usb-c-data-cable",
            "desktop-mic-stand"
          ]
        }
      },
      "limitations": [
        "No measured café-dictation performance evidence.",
        "USB data cable + desk / boom mount for computer use",
        "Compatibility paths are bounded demo fixtures; other paths are unknown."
      ],
      "evidenceIds": [
        "SRC-MIC-044",
        "FIT-MIC-044",
        "COMPAT-MIC-044",
        "REV-MIC-044"
      ],
      "sourceUrls": [
        "https://www.sweetwater.com/store/detail/VideoMicGo2H--rode-videomic-go-ii-camera-mounted-shotgun-microphone",
        "https://www.sweetwater.com/store/detail/VideoMicGo2H--rode-videomic-go-ii-camera-mounted-shotgun-microphone/reviews"
      ],
      "referencePrice": {
        "currency": "USD",
        "amountMinor": 10900,
        "price_kind": "observed_page",
        "payableTotalMinor": null
      },
      "sourceAvailability": "in_stock",
      "buyerMetrics": {
        "rating": 5,
        "ratingCount": 2,
        "writtenReviewCount": 2,
        "purchaseCount": null,
        "purchaseCountPeriod": null,
        "reviewScope": "Rendered customer reviews"
      },
      "authoredFit": {
        "demo_cafe_fit": 3,
        "demo_office_fit": 4,
        "assessment": "Lightweight directional option; bring it close to the speaker instead of treating it as an across-room mic.",
        "measuredPerformance": false
      },
      "video": {
        "status": "missing",
        "reason": "No permission-verified playable product video/excerpt was curated for this fixture."
      }
    },
    {
      "id": "MIC-047",
      "category": "audio-accessories",
      "brand": "Deity",
      "model": "V-Mic D4 Mini",
      "variantId": "MIC-047-DEMO",
      "title": "Deity V-Mic D4 Mini",
      "checkedOn": "2026-10-24",
      "image": {
        "url": "/catalog/images/audio.svg",
        "alt": "Generic demo audio illustration, not a photograph of this model",
        "source": "Authored demo illustration",
        "classification": "proxy"
      },
      "specs": {
        "capsule / mic system": "Condenser",
        "polar_pattern": "Supercardioid",
        "connection": "3.5mm TRS; supplied TRRS host cable",
        "power": "1–5V plug-in power",
        "additional_hardware": "Mic-capable USB adapter for USB-only hosts; mount",
        "noise_strategy": "Directional pickup; included windscreen",
        "sourceVariant": "V-Mic D4 Mini",
        "compatibilityFixture": {
          "supportedHostConnections": [
            "usb-c"
          ],
          "requiredHardwareIds": [
            "usb-c-trs-mic-interface",
            "desktop-mic-stand"
          ]
        }
      },
      "limitations": [
        "No measured café-dictation performance evidence.",
        "Mic-capable USB adapter for USB-only hosts; mount",
        "Compatibility paths are bounded demo fixtures; other paths are unknown."
      ],
      "evidenceIds": [
        "SRC-MIC-047",
        "FIT-MIC-047",
        "COMPAT-MIC-047",
        "REV-MIC-047"
      ],
      "sourceUrls": [
        "https://shop.deitymic.com/products/d4-mini",
        "https://shop.deitymic.com/products/d4-mini"
      ],
      "referencePrice": {
        "currency": "USD",
        "amountMinor": 4995,
        "price_kind": "observed_page",
        "payableTotalMinor": null
      },
      "sourceAvailability": "in_stock",
      "buyerMetrics": {
        "rating": null,
        "ratingCount": null,
        "writtenReviewCount": 43,
        "purchaseCount": null,
        "purchaseCountPeriod": null,
        "reviewScope": "Shop review count; aggregate score not exposed"
      },
      "authoredFit": {
        "demo_cafe_fit": 3,
        "demo_office_fit": 4,
        "assessment": "Low-cost directional demo option; ensure the adapter supplies microphone plug-in power.",
        "measuredPerformance": false
      },
      "video": {
        "status": "missing",
        "reason": "No permission-verified playable product video/excerpt was curated for this fixture."
      }
    },
    {
      "id": "BAG-001",
      "category": "everyday-bags",
      "brand": "Osprey",
      "model": "Daylite Large Tote Pack",
      "variantId": "BAG-001-DEMO",
      "title": "Osprey Daylite Large Tote Pack — one size / neutral demo color",
      "image": {
        "url": "/catalog/images/bag.svg",
        "alt": "Bag illustration; not a photograph of Daylite Large Tote Pack",
        "source": "Authored demo illustration",
        "classification": "proxy"
      },
      "specs": {
        "dimensions": {
          "unit": "cm",
          "height": 37.5,
          "width": 50,
          "depth": 19,
          "axisOrder": "manufacturer H/W/D"
        },
        "capacityLitres": 26,
        "expandedCapacityLitres": null,
        "weightGrams": 722,
        "material": "Recycled 300D polyester",
        "carryModes": [
          "tote",
          "backpack"
        ],
        "compartments": [
          "padded laptop sleeve",
          "bottom shoe or dirty-towel section",
          "luggage sleeve"
        ],
        "laptopFitInches": 16,
        "separateShoeCompartment": true,
        "waterResistance": "Manufacturer states DWR treatment; waterproofness unverified",
        "specificationClassification": "snapshot",
        "demoVariant": {
          "classification": "proxy",
          "color": "neutral demo color; not a verified retail SKU",
          "includedPieces": null,
          "packageAssumption": null
        }
      },
      "limitations": [
        "Laptop diagonal is nominal, not a guarantee for every device.",
        "Neutral demo color is not a verified retail SKU."
      ],
      "evidenceIds": [
        "SRC-BAG-001",
        "DEMO-BAG-001"
      ],
      "checkedOn": "2026-10-24",
      "sourceUrls": [
        "https://www.osprey.com/daylitetm-large-tote-pack"
      ],
      "referencePrice": {
        "currency": "USD",
        "amountMinor": 11000,
        "price_kind": "from_price",
        "payableTotalMinor": null
      },
      "sourceAvailability": "unknown",
      "buyerMetrics": {
        "rating": null,
        "ratingCount": null,
        "writtenReviewCount": null,
        "purchaseCount": null,
        "purchaseCountPeriod": null,
        "reviewScope": null
      },
      "authoredFit": null,
      "video": {
        "status": "missing",
        "reason": "No product-specific playable video with verified reuse/embed permission was curated; show missing media."
      }
    },
    {
      "id": "BAG-002",
      "category": "everyday-bags",
      "brand": "Osprey",
      "model": "Daylite Tote Pack 20L",
      "variantId": "BAG-002-DEMO",
      "title": "Osprey Daylite Tote Pack 20L — one size / neutral demo color",
      "image": {
        "url": "/catalog/images/bag.svg",
        "alt": "Bag illustration; not a photograph of Daylite Tote Pack 20L",
        "source": "Authored demo illustration",
        "classification": "proxy"
      },
      "specs": {
        "dimensions": {
          "unit": "cm",
          "height": 21,
          "width": 38,
          "depth": 43,
          "axisOrder": "manufacturer H/W/D"
        },
        "dimensionCaveat": "Unusual axis labels retained from the source; do not infer internal fit.",
        "capacityLitres": 20,
        "expandedCapacityLitres": null,
        "weightGrams": 534,
        "material": "Recycled 300D polyester",
        "carryModes": [
          "tote",
          "backpack"
        ],
        "compartments": [
          "padded laptop or reservoir sleeve",
          "bottle pockets",
          "internal mesh pocket",
          "luggage pass-through"
        ],
        "laptopFitInches": 14,
        "separateShoeCompartment": null,
        "waterResistance": "Manufacturer states DWR treatment; waterproofness unverified",
        "sourceColor": "Tumbleweed Yellow/Tunnel Vision",
        "specificationClassification": "snapshot",
        "demoVariant": {
          "classification": "proxy",
          "color": "neutral demo color; not a verified retail SKU",
          "includedPieces": null,
          "packageAssumption": null
        }
      },
      "limitations": [
        "Separate shoe storage is unknown.",
        "Source dimensions have unusual axis order.",
        "Demo color differs from the linked retail variant."
      ],
      "evidenceIds": [
        "SRC-BAG-002",
        "DEMO-BAG-002"
      ],
      "checkedOn": "2026-10-24",
      "sourceUrls": [
        "https://www.osprey.com/daylite-tote-pack-daylttotpks21-779?color=Tumbleweed+Yellow%2FTunnel+Vision&size=O%2FS"
      ],
      "referencePrice": {
        "currency": "USD",
        "amountMinor": 9500,
        "price_kind": "from_price",
        "payableTotalMinor": null
      },
      "sourceAvailability": "unknown",
      "buyerMetrics": {
        "rating": null,
        "ratingCount": null,
        "writtenReviewCount": null,
        "purchaseCount": null,
        "purchaseCountPeriod": null,
        "reviewScope": null
      },
      "authoredFit": null,
      "video": {
        "status": "missing",
        "reason": "No product-specific playable video with verified reuse/embed permission was curated; show missing media."
      }
    },
    {
      "id": "BAG-003",
      "category": "everyday-bags",
      "brand": "Osprey",
      "model": "Daylite Messenger",
      "variantId": "BAG-003-DEMO",
      "title": "Osprey Daylite Messenger — one size / neutral demo color",
      "image": {
        "url": "/catalog/images/bag.svg",
        "alt": "Bag illustration; not a photograph of Daylite Messenger",
        "source": "Authored demo illustration",
        "classification": "proxy"
      },
      "specs": {
        "dimensions": {
          "unit": "in",
          "height": 16.93,
          "width": 11.81,
          "depth": 6.69,
          "axisOrder": "manufacturer H/W/D"
        },
        "capacityLitres": 12,
        "expandedCapacityLitres": null,
        "weightGrams": null,
        "material": "Recycled 300D polyester",
        "carryModes": [
          "shoulder",
          "hand carry"
        ],
        "compartments": [
          "laptop sleeve",
          "bottle pocket",
          "side zip pocket",
          "key clip",
          "buckle flap"
        ],
        "laptopFitInches": 14,
        "separateShoeCompartment": null,
        "waterResistance": "Manufacturer states DWR treatment; waterproofness unverified",
        "specificationClassification": "snapshot",
        "demoVariant": {
          "classification": "proxy",
          "color": "neutral demo color; not a verified retail SKU",
          "includedPieces": null,
          "packageAssumption": null
        }
      },
      "limitations": [
        "Empty weight and separate shoe storage were not captured.",
        "Neutral demo color is not a verified retail SKU."
      ],
      "evidenceIds": [
        "SRC-BAG-003",
        "DEMO-BAG-003"
      ],
      "checkedOn": "2026-10-24",
      "sourceUrls": [
        "https://www.osprey.com/daylitetm-messenger"
      ],
      "referencePrice": {
        "currency": "USD",
        "amountMinor": 8000,
        "price_kind": "from_price",
        "payableTotalMinor": null
      },
      "sourceAvailability": "unknown",
      "buyerMetrics": {
        "rating": null,
        "ratingCount": null,
        "writtenReviewCount": null,
        "purchaseCount": null,
        "purchaseCountPeriod": null,
        "reviewScope": null
      },
      "authoredFit": null,
      "video": {
        "status": "missing",
        "reason": "No product-specific playable video with verified reuse/embed permission was curated; show missing media."
      }
    },
    {
      "id": "BAG-004",
      "category": "everyday-bags",
      "brand": "Osprey",
      "model": "Daylite Duffel 30",
      "variantId": "BAG-004-DEMO",
      "title": "Osprey Daylite Duffel 30 — one size / neutral demo color",
      "image": {
        "url": "/catalog/images/bag.svg",
        "alt": "Bag illustration; not a photograph of Daylite Duffel 30",
        "source": "Authored demo illustration",
        "classification": "proxy"
      },
      "specs": {
        "dimensions": {
          "unit": "cm",
          "height": 50,
          "width": 33,
          "depth": 24,
          "axisOrder": "manufacturer H/W/D"
        },
        "capacityLitres": 30,
        "expandedCapacityLitres": null,
        "weightGrams": 550,
        "material": "Recycled 300D polyester ripstop",
        "carryModes": [
          "backpack",
          "shoulder",
          "hand carry"
        ],
        "compartments": [
          "wide main opening",
          "end zip pocket",
          "side zip pocket",
          "padded bottom"
        ],
        "laptopFitInches": null,
        "separateShoeCompartment": null,
        "waterResistance": "Manufacturer states DWR treatment; waterproofness unverified",
        "specificationClassification": "snapshot",
        "demoVariant": {
          "classification": "proxy",
          "color": "neutral demo color; not a verified retail SKU",
          "includedPieces": null,
          "packageAssumption": null
        }
      },
      "limitations": [
        "Dedicated laptop protection and shoe separation are unverified.",
        "Neutral demo color is not a verified retail SKU."
      ],
      "evidenceIds": [
        "SRC-BAG-004",
        "DEMO-BAG-004"
      ],
      "checkedOn": "2026-10-24",
      "sourceUrls": [
        "https://www.osprey.com/daylitetm-duffel-30"
      ],
      "referencePrice": {
        "currency": "USD",
        "amountMinor": 8500,
        "price_kind": "from_price",
        "payableTotalMinor": null
      },
      "sourceAvailability": "unknown",
      "buyerMetrics": {
        "rating": null,
        "ratingCount": null,
        "writtenReviewCount": null,
        "purchaseCount": null,
        "purchaseCountPeriod": null,
        "reviewScope": null
      },
      "authoredFit": null,
      "video": {
        "status": "missing",
        "reason": "No product-specific playable video with verified reuse/embed permission was curated; show missing media."
      }
    },
    {
      "id": "BAG-005",
      "category": "everyday-bags",
      "brand": "Osprey",
      "model": "Daylite Expandable Travel Pack 26+6",
      "variantId": "BAG-005-DEMO",
      "title": "Osprey Daylite Expandable Travel Pack 26+6 — one size / neutral demo color",
      "image": {
        "url": "/catalog/images/bag.svg",
        "alt": "Bag illustration; not a photograph of Daylite Expandable Travel Pack 26+6",
        "source": "Authored demo illustration",
        "classification": "proxy"
      },
      "specs": {
        "dimensions": {
          "unit": "cm",
          "height": 43,
          "width": 33,
          "depth": 16,
          "axisOrder": "manufacturer H/W/D, unexpanded"
        },
        "capacityLitres": 26,
        "expandedCapacityLitres": 32,
        "weightGrams": 840,
        "material": "Recycled 300D polyester ripstop",
        "carryModes": [
          "backpack",
          "hand carry"
        ],
        "compartments": [
          "tech sleeve",
          "bottle pockets",
          "luggage pass-through",
          "internal tie-down"
        ],
        "laptopFitInches": null,
        "separateShoeCompartment": null,
        "waterResistance": "Manufacturer states DWR treatment; waterproofness unverified",
        "specificationClassification": "snapshot",
        "demoVariant": {
          "classification": "proxy",
          "color": "neutral demo color; not a verified retail SKU",
          "includedPieces": null,
          "packageAssumption": null
        }
      },
      "limitations": [
        "Airline acceptance depends on the actual airline and packed dimensions.",
        "Exact laptop compatibility is unknown.",
        "Neutral demo color is not a verified retail SKU."
      ],
      "evidenceIds": [
        "SRC-BAG-005",
        "DEMO-BAG-005"
      ],
      "checkedOn": "2026-10-24",
      "sourceUrls": [
        "https://www.osprey.com/daylitetm-expandable-travel-pack-26-6"
      ],
      "referencePrice": {
        "currency": "USD",
        "amountMinor": 11000,
        "price_kind": "from_price",
        "payableTotalMinor": null
      },
      "sourceAvailability": "unknown",
      "buyerMetrics": {
        "rating": null,
        "ratingCount": null,
        "writtenReviewCount": null,
        "purchaseCount": null,
        "purchaseCountPeriod": null,
        "reviewScope": null
      },
      "authoredFit": null,
      "video": {
        "status": "missing",
        "reason": "No product-specific playable video with verified reuse/embed permission was curated; show missing media."
      }
    },
    {
      "id": "BAG-006",
      "category": "everyday-bags",
      "brand": "Osprey",
      "model": "Daylite Plus Driftshade Backpack",
      "variantId": "BAG-006-DEMO",
      "title": "Osprey Daylite Plus Driftshade Backpack — one size / neutral demo color",
      "image": {
        "url": "/catalog/images/bag.svg",
        "alt": "Bag illustration; not a photograph of Daylite Plus Driftshade Backpack",
        "source": "Authored demo illustration",
        "classification": "proxy"
      },
      "specs": {
        "dimensions": {
          "unit": "cm",
          "height": 48,
          "width": 28,
          "depth": 24,
          "axisOrder": "manufacturer H/W/D"
        },
        "capacityLitres": 20,
        "expandedCapacityLitres": null,
        "weightGrams": 610,
        "material": "Recycled 600D heathered polyester",
        "carryModes": [
          "backpack"
        ],
        "compartments": [
          "padded laptop or reservoir sleeve",
          "bottle pockets",
          "front pockets",
          "compression straps",
          "hipbelt"
        ],
        "laptopFitInches": 14,
        "separateShoeCompartment": null,
        "waterResistance": "Manufacturer states DWR treatment; waterproofness unverified",
        "specificationClassification": "snapshot",
        "demoVariant": {
          "classification": "proxy",
          "color": "neutral demo color; not a verified retail SKU",
          "includedPieces": null,
          "packageAssumption": null
        }
      },
      "limitations": [
        "Dedicated shoe separation was not established.",
        "Neutral demo color is not a verified retail SKU."
      ],
      "evidenceIds": [
        "SRC-BAG-006",
        "DEMO-BAG-006"
      ],
      "checkedOn": "2026-10-24",
      "sourceUrls": [
        "https://www.osprey.com/daylitetm-plus-driftshade-backpack"
      ],
      "referencePrice": {
        "currency": "USD",
        "amountMinor": 8500,
        "price_kind": "from_price",
        "payableTotalMinor": null
      },
      "sourceAvailability": "unknown",
      "buyerMetrics": {
        "rating": null,
        "ratingCount": null,
        "writtenReviewCount": null,
        "purchaseCount": null,
        "purchaseCountPeriod": null,
        "reviewScope": null
      },
      "authoredFit": null,
      "video": {
        "status": "missing",
        "reason": "No product-specific playable video with verified reuse/embed permission was curated; show missing media."
      }
    },
    {
      "id": "BED-001",
      "category": "bedsheet-sets",
      "brand": "IKEA",
      "model": "DVALA sheet set",
      "variantId": "BED-001-DEMO",
      "title": "IKEA DVALA sheet set — US Queen / white",
      "image": {
        "url": "/catalog/images/bedding.svg",
        "alt": "Bedding illustration; not a photograph of DVALA sheet set",
        "source": "Authored demo illustration",
        "classification": "proxy"
      },
      "specs": {
        "fittedWidthInches": 60,
        "fittedLengthInches": 80,
        "flatWidthInches": 90,
        "flatLengthInches": 104,
        "pillowcaseWidthInches": 20,
        "pillowcaseLengthInches": 30,
        "includedPieces": {
          "fitted": 1,
          "flat": 1,
          "pillowcases": 2
        },
        "sizeMarket": "US Queen",
        "care": "Machine wash normal at max 60 C; tumble medium; no bleach; iron high; no dry cleaning. Maximum stated shrinkage 4%.",
        "articleNumber": "705.775.31",
        "color": "white",
        "material": "cotton",
        "compositionLabel": "100% cotton",
        "composition": [
          {
            "fiber": "cotton",
            "percent": 100
          }
        ],
        "weave": null,
        "threadCount": 152,
        "maxMattressDepthInches": 10,
        "depthCaveat": "Source also states 25 cm; 10-inch field is the product measurement-table value.",
        "specificationClassification": "snapshot",
        "demoVariant": {
          "classification": "proxy",
          "color": "white",
          "includedPieces": null,
          "packageAssumption": null
        }
      },
      "limitations": [
        "Do not infer compatibility from the Queen label alone.",
        "Listed maximum mattress depth excludes deeper mattresses."
      ],
      "evidenceIds": [
        "SRC-BED-001",
        "DEMO-BED-001",
        "REV-BED-001"
      ],
      "checkedOn": "2026-10-24",
      "sourceUrls": [
        "https://www.ikea.com/us/en/p/dvala-sheet-set-white-70577531/"
      ],
      "referencePrice": {
        "currency": "USD",
        "amountMinor": 2999,
        "price_kind": "observed_page",
        "payableTotalMinor": null
      },
      "sourceAvailability": "unknown",
      "buyerMetrics": {
        "rating": 3.6,
        "ratingCount": null,
        "writtenReviewCount": 247,
        "purchaseCount": null,
        "purchaseCountPeriod": null,
        "reviewScope": "Product-family aggregate includes other colors; exact-size grouping unverified. Count labelled Total reviews; ratingCount not separately exposed."
      },
      "authoredFit": null,
      "video": {
        "status": "missing",
        "reason": "No product-specific playable video with verified reuse/embed permission was curated; show missing media."
      }
    },
    {
      "id": "BED-002",
      "category": "bedsheet-sets",
      "brand": "IKEA",
      "model": "NATTJASMIN sheet set",
      "variantId": "BED-002-DEMO",
      "title": "IKEA NATTJASMIN sheet set — US Queen / white",
      "image": {
        "url": "/catalog/images/bedding.svg",
        "alt": "Bedding illustration; not a photograph of NATTJASMIN sheet set",
        "source": "Authored demo illustration",
        "classification": "proxy"
      },
      "specs": {
        "fittedWidthInches": 60,
        "fittedLengthInches": 80,
        "flatWidthInches": 90,
        "flatLengthInches": 104,
        "pillowcaseWidthInches": 20,
        "pillowcaseLengthInches": 30,
        "includedPieces": {
          "fitted": 1,
          "flat": 1,
          "pillowcases": 2
        },
        "sizeMarket": "US Queen",
        "care": "Machine wash normal at max 60 C; tumble medium; no bleach; iron high; no dry cleaning. Maximum stated shrinkage 4%.",
        "articleNumber": "006.011.53",
        "color": "white",
        "material": "cotton/lyocell",
        "compositionLabel": "60% cotton, 40% lyocell",
        "composition": [
          {
            "fiber": "cotton",
            "percent": 60
          },
          {
            "fiber": "lyocell",
            "percent": 40
          }
        ],
        "weave": "sateen",
        "threadCount": 310,
        "maxMattressDepthInches": 15,
        "specificationClassification": "snapshot",
        "demoVariant": {
          "classification": "proxy",
          "color": "white",
          "includedPieces": null,
          "packageAssumption": null
        }
      },
      "limitations": [
        "Reported mattress-fit experiences vary.",
        "Fabric composition does not guarantee cooling."
      ],
      "evidenceIds": [
        "SRC-BED-002",
        "DEMO-BED-002",
        "REV-BED-002"
      ],
      "checkedOn": "2026-10-24",
      "sourceUrls": [
        "https://www.ikea.com/us/en/p/nattjasmin-sheet-set-white-00601153/"
      ],
      "referencePrice": {
        "currency": "USD",
        "amountMinor": 5999,
        "price_kind": "observed_page",
        "payableTotalMinor": null
      },
      "sourceAvailability": "unknown",
      "buyerMetrics": {
        "rating": 4.3,
        "ratingCount": null,
        "writtenReviewCount": 47,
        "purchaseCount": null,
        "purchaseCountPeriod": null,
        "reviewScope": "Product-family aggregate includes other colors; exact-size grouping unverified. Count labelled Total reviews; ratingCount not separately exposed."
      },
      "authoredFit": null,
      "video": {
        "status": "missing",
        "reason": "No product-specific playable video with verified reuse/embed permission was curated; show missing media."
      }
    },
    {
      "id": "BED-003",
      "category": "bedsheet-sets",
      "brand": "IKEA",
      "model": "ULLVIDE sheet set",
      "variantId": "BED-003-DEMO",
      "title": "IKEA ULLVIDE sheet set — US Queen / white",
      "image": {
        "url": "/catalog/images/bedding.svg",
        "alt": "Bedding illustration; not a photograph of ULLVIDE sheet set",
        "source": "Authored demo illustration",
        "classification": "proxy"
      },
      "specs": {
        "fittedWidthInches": 60,
        "fittedLengthInches": 80,
        "flatWidthInches": 90,
        "flatLengthInches": 104,
        "pillowcaseWidthInches": 20,
        "pillowcaseLengthInches": 30,
        "includedPieces": {
          "fitted": 1,
          "flat": 1,
          "pillowcases": 2
        },
        "sizeMarket": "US Queen",
        "care": "Machine wash normal at max 60 C; tumble medium; no bleach; iron high; no dry cleaning. Maximum stated shrinkage 4%.",
        "articleNumber": "905.775.11",
        "color": "white",
        "material": "cotton/lyocell",
        "compositionLabel": "85% cotton, 15% lyocell",
        "composition": [
          {
            "fiber": "cotton",
            "percent": 85
          },
          {
            "fiber": "lyocell",
            "percent": 15
          }
        ],
        "weave": "percale",
        "threadCount": 200,
        "maxMattressDepthInches": 14.625,
        "depthCaveat": "Conservative descriptive limit 14 5/8 inches; measurement table rounds to 15.",
        "specificationClassification": "snapshot",
        "demoVariant": {
          "classification": "proxy",
          "color": "white",
          "includedPieces": null,
          "packageAssumption": null
        }
      },
      "limitations": [
        "Conservative depth limit is retained where source fields disagree.",
        "No cooling guarantee."
      ],
      "evidenceIds": [
        "SRC-BED-003",
        "DEMO-BED-003",
        "REV-BED-003"
      ],
      "checkedOn": "2026-10-24",
      "sourceUrls": [
        "https://www.ikea.com/us/en/p/ullvide-sheet-set-white-90577511/"
      ],
      "referencePrice": {
        "currency": "USD",
        "amountMinor": 4999,
        "price_kind": "observed_page",
        "payableTotalMinor": null
      },
      "sourceAvailability": "unknown",
      "buyerMetrics": {
        "rating": 4,
        "ratingCount": null,
        "writtenReviewCount": 41,
        "purchaseCount": null,
        "purchaseCountPeriod": null,
        "reviewScope": "Product-family aggregate includes other colors; exact-size grouping unverified. Count labelled Total reviews; ratingCount not separately exposed."
      },
      "authoredFit": null,
      "video": {
        "status": "missing",
        "reason": "No product-specific playable video with verified reuse/embed permission was curated; show missing media."
      }
    },
    {
      "id": "BED-004",
      "category": "bedsheet-sets",
      "brand": "IKEA",
      "model": "SOLFIBBLA sheet set",
      "variantId": "BED-004-DEMO",
      "title": "IKEA SOLFIBBLA sheet set — US Queen / white green/stripe",
      "image": {
        "url": "/catalog/images/bedding.svg",
        "alt": "Bedding illustration; not a photograph of SOLFIBBLA sheet set",
        "source": "Authored demo illustration",
        "classification": "proxy"
      },
      "specs": {
        "fittedWidthInches": 60,
        "fittedLengthInches": 80,
        "flatWidthInches": 90,
        "flatLengthInches": 104,
        "pillowcaseWidthInches": 20,
        "pillowcaseLengthInches": 30,
        "includedPieces": {
          "fitted": 1,
          "flat": 1,
          "pillowcases": 2
        },
        "sizeMarket": "US Queen",
        "care": "Machine wash normal at max 60 C; tumble medium; no bleach; iron high; no dry cleaning. Maximum stated shrinkage 4%.",
        "articleNumber": "606.158.35",
        "color": "white green/stripe",
        "material": "cotton",
        "compositionLabel": "100% cotton",
        "composition": [
          {
            "fiber": "cotton",
            "percent": 100
          }
        ],
        "weave": null,
        "pattern": "yarn-dyed stripes",
        "threadCount": 118,
        "maxMattressDepthInches": 10,
        "specificationClassification": "snapshot",
        "demoVariant": {
          "classification": "proxy",
          "color": "white green/stripe",
          "includedPieces": null,
          "packageAssumption": null
        }
      },
      "limitations": [
        "Product page reports 56 reviews; a category snapshot reported 58.",
        "Listed depth excludes deeper mattresses."
      ],
      "evidenceIds": [
        "SRC-BED-004",
        "DEMO-BED-004",
        "REV-BED-004"
      ],
      "checkedOn": "2026-10-24",
      "sourceUrls": [
        "https://www.ikea.com/us/en/p/solfibbla-sheet-set-white-green-stripe-60615835/"
      ],
      "referencePrice": {
        "currency": "USD",
        "amountMinor": 3999,
        "price_kind": "observed_page",
        "payableTotalMinor": null
      },
      "sourceAvailability": "unknown",
      "buyerMetrics": {
        "rating": 3.7,
        "ratingCount": null,
        "writtenReviewCount": 56,
        "purchaseCount": null,
        "purchaseCountPeriod": null,
        "reviewScope": "Product-family aggregate includes other colors; exact-size grouping unverified. Count labelled Total reviews; ratingCount not separately exposed."
      },
      "authoredFit": null,
      "video": {
        "status": "missing",
        "reason": "No product-specific playable video with verified reuse/embed permission was curated; show missing media."
      }
    },
    {
      "id": "BED-005",
      "category": "bedsheet-sets",
      "brand": "Brooklinen",
      "model": "Classic Percale Core Sheet Set",
      "variantId": "BED-005-DEMO",
      "title": "Brooklinen Classic Percale Core Sheet Set — US Queen / white demo package",
      "image": {
        "url": "/catalog/images/bedding.svg",
        "alt": "Bedding illustration; not a photograph of Classic Percale Core Sheet Set",
        "source": "Authored demo illustration",
        "classification": "proxy"
      },
      "specs": {
        "sizeMarket": "US Queen",
        "material": "long-staple cotton",
        "compositionLabel": "100% cotton",
        "composition": [
          {
            "fiber": "cotton",
            "percent": 100
          }
        ],
        "weave": "percale",
        "threadCount": 270,
        "fittedWidthInches": 60,
        "fittedLengthInches": 80,
        "maxMattressDepthInches": 16,
        "preferredMattressDepthInches": {
          "minimum": 12,
          "maximum": 16
        },
        "flatWidthInches": 92,
        "flatLengthInches": 104,
        "pillowcaseWidthInches": 20,
        "pillowcaseLengthInches": 27,
        "includedPieces": null,
        "care": null,
        "color": null,
        "specificationClassification": "snapshot",
        "demoVariant": {
          "classification": "proxy",
          "color": "white, assumed for demo",
          "includedPieces": {
            "fitted": 1,
            "flat": 1,
            "pillowcases": 2
          },
          "packageAssumption": "Four-piece demo package only; retail package count remains unknown."
        }
      },
      "limitations": [
        "Exact retail package count, care, color, and selected-variant price were not captured.",
        "Demo package assumptions are separate from sourced specifications."
      ],
      "evidenceIds": [
        "SRC-BED-005",
        "DEMO-BED-005"
      ],
      "checkedOn": "2026-10-24",
      "sourceUrls": [
        "https://www.brooklinen.com/products/classic-core-sheet-set"
      ],
      "referencePrice": {
        "currency": "USD",
        "amountMinor": 19900,
        "price_kind": "demo_estimate",
        "payableTotalMinor": null
      },
      "sourceAvailability": "unknown",
      "buyerMetrics": {
        "rating": null,
        "ratingCount": null,
        "writtenReviewCount": null,
        "purchaseCount": null,
        "purchaseCountPeriod": null,
        "reviewScope": null
      },
      "authoredFit": null,
      "video": {
        "status": "missing",
        "reason": "No product-specific playable video with verified reuse/embed permission was curated; show missing media."
      }
    },
    {
      "id": "BED-006",
      "category": "bedsheet-sets",
      "brand": "Brooklinen",
      "model": "Washed European Linen Core Sheet Set",
      "variantId": "BED-006-DEMO",
      "title": "Brooklinen Washed European Linen Core Sheet Set — US Queen / white demo package",
      "image": {
        "url": "/catalog/images/bedding.svg",
        "alt": "Bedding illustration; not a photograph of Washed European Linen Core Sheet Set",
        "source": "Authored demo illustration",
        "classification": "proxy"
      },
      "specs": {
        "sizeMarket": "US Queen",
        "material": "European flax linen",
        "compositionLabel": "100% linen",
        "composition": [
          {
            "fiber": "linen",
            "percent": 100
          }
        ],
        "weave": null,
        "threadCount": null,
        "fabricWeightGsm": 155,
        "fittedWidthInches": 60,
        "fittedLengthInches": 80,
        "maxMattressDepthInches": null,
        "pocketDepthInches": 15,
        "flatWidthInches": 92,
        "flatLengthInches": 104,
        "pillowcaseWidthInches": 20,
        "pillowcaseLengthInches": 27,
        "includedPieces": null,
        "care": null,
        "color": null,
        "specificationClassification": "snapshot",
        "demoVariant": {
          "classification": "proxy",
          "color": "white, assumed for demo",
          "includedPieces": {
            "fitted": 1,
            "flat": 1,
            "pillowcases": 2
          },
          "packageAssumption": "Four-piece demo package only; retail package count remains unknown."
        }
      },
      "limitations": [
        "Size-guide pocket height is not an explicit mattress-fit guarantee.",
        "Exact retail package count, care, color, and selected-variant price were not captured."
      ],
      "evidenceIds": [
        "SRC-BED-006",
        "DEMO-BED-006"
      ],
      "checkedOn": "2026-10-24",
      "sourceUrls": [
        "https://www.brooklinen.com/products/washed-linen-core-sheet-set"
      ],
      "referencePrice": {
        "currency": "USD",
        "amountMinor": 37900,
        "price_kind": "demo_estimate",
        "payableTotalMinor": null
      },
      "sourceAvailability": "unknown",
      "buyerMetrics": {
        "rating": null,
        "ratingCount": null,
        "writtenReviewCount": null,
        "purchaseCount": null,
        "purchaseCountPeriod": null,
        "reviewScope": null
      },
      "authoredFit": null,
      "video": {
        "status": "missing",
        "reason": "No product-specific playable video with verified reuse/embed permission was curated; show missing media."
      }
    }
  ],
  "sellers": [
    {
      "id": "DEMO-VALUE",
      "name": "Demo Value Seller — fictional",
      "classification": "proxy",
      "evidenceIds": [
        "SELLER-VALUE"
      ]
    },
    {
      "id": "DEMO-EXPRESS",
      "name": "Demo Express Seller — fictional",
      "classification": "proxy",
      "evidenceIds": [
        "SELLER-EXPRESS"
      ]
    }
  ],
  "offers": [
    {
      "id": "MIC-001-A",
      "productId": "MIC-001",
      "variantId": "MIC-001-DEMO",
      "sellerId": "DEMO-VALUE",
      "currency": "USD",
      "unitPriceMinor": 1900,
      "shippingMinor": 500,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 2400,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-28T09:00:00+08:00",
        "latest": "2026-10-28T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 14 days of simulated delivery; item price refunded, outbound shipping excluded, USD 5 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-VALUE",
        "FIXTURE-MIC-001-A"
      ],
      "classification": "proxy",
      "setupHardware": []
    },
    {
      "id": "MIC-001-B",
      "productId": "MIC-001",
      "variantId": "MIC-001-DEMO",
      "sellerId": "DEMO-EXPRESS",
      "currency": "USD",
      "unitPriceMinor": 2400,
      "shippingMinor": 900,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 3300,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-25T09:00:00+08:00",
        "latest": "2026-10-25T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 30 days of simulated delivery; item price refunded, outbound shipping excluded, USD 0 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-EXPRESS",
        "FIXTURE-MIC-001-B"
      ],
      "classification": "proxy",
      "setupHardware": []
    },
    {
      "id": "MIC-003-A",
      "productId": "MIC-003",
      "variantId": "MIC-003-DEMO",
      "sellerId": "DEMO-VALUE",
      "currency": "USD",
      "unitPriceMinor": 2200,
      "shippingMinor": 500,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 2700,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-28T09:00:00+08:00",
        "latest": "2026-10-28T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 14 days of simulated delivery; item price refunded, outbound shipping excluded, USD 5 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-VALUE",
        "FIXTURE-MIC-003-A"
      ],
      "classification": "proxy",
      "setupHardware": []
    },
    {
      "id": "MIC-003-B",
      "productId": "MIC-003",
      "variantId": "MIC-003-DEMO",
      "sellerId": "DEMO-EXPRESS",
      "currency": "USD",
      "unitPriceMinor": 2900,
      "shippingMinor": 900,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 3800,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-25T09:00:00+08:00",
        "latest": "2026-10-25T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 30 days of simulated delivery; item price refunded, outbound shipping excluded, USD 0 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-EXPRESS",
        "FIXTURE-MIC-003-B"
      ],
      "classification": "proxy",
      "setupHardware": []
    },
    {
      "id": "MIC-009-A",
      "productId": "MIC-009",
      "variantId": "MIC-009-DEMO",
      "sellerId": "DEMO-VALUE",
      "currency": "USD",
      "unitPriceMinor": 27700,
      "shippingMinor": 500,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 28200,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-28T09:00:00+08:00",
        "latest": "2026-10-28T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 14 days of simulated delivery; item price refunded, outbound shipping excluded, USD 5 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-VALUE",
        "FIXTURE-MIC-009-A"
      ],
      "classification": "proxy",
      "setupHardware": []
    },
    {
      "id": "MIC-009-B",
      "productId": "MIC-009",
      "variantId": "MIC-009-DEMO",
      "sellerId": "DEMO-EXPRESS",
      "currency": "USD",
      "unitPriceMinor": 28700,
      "shippingMinor": 900,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 29600,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-25T09:00:00+08:00",
        "latest": "2026-10-25T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 30 days of simulated delivery; item price refunded, outbound shipping excluded, USD 0 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-EXPRESS",
        "FIXTURE-MIC-009-B"
      ],
      "classification": "proxy",
      "setupHardware": []
    },
    {
      "id": "MIC-015-A",
      "productId": "MIC-015",
      "variantId": "MIC-015-DEMO",
      "sellerId": "DEMO-VALUE",
      "currency": "USD",
      "unitPriceMinor": 16900,
      "shippingMinor": 500,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 17400,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-28T09:00:00+08:00",
        "latest": "2026-10-28T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 14 days of simulated delivery; item price refunded, outbound shipping excluded, USD 5 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-VALUE",
        "FIXTURE-MIC-015-A"
      ],
      "classification": "proxy",
      "setupHardware": []
    },
    {
      "id": "MIC-015-B",
      "productId": "MIC-015",
      "variantId": "MIC-015-DEMO",
      "sellerId": "DEMO-EXPRESS",
      "currency": "USD",
      "unitPriceMinor": 17900,
      "shippingMinor": 900,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 18800,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-25T09:00:00+08:00",
        "latest": "2026-10-25T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 30 days of simulated delivery; item price refunded, outbound shipping excluded, USD 0 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-EXPRESS",
        "FIXTURE-MIC-015-B"
      ],
      "classification": "proxy",
      "setupHardware": []
    },
    {
      "id": "MIC-020-A",
      "productId": "MIC-020",
      "variantId": "MIC-020-DEMO",
      "sellerId": "DEMO-VALUE",
      "currency": "USD",
      "unitPriceMinor": 5800,
      "shippingMinor": 500,
      "otherFeesMinor": 500,
      "taxMinor": 0,
      "totalMinor": 6800,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-28T09:00:00+08:00",
        "latest": "2026-10-28T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 14 days of simulated delivery; item price refunded, outbound shipping excluded, USD 5 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle.",
        "Required demo setup hardware is included in otherFeesMinor and must be shown in the purchase summary."
      ],
      "evidenceIds": [
        "SELLER-VALUE",
        "FIXTURE-MIC-020-A"
      ],
      "classification": "proxy",
      "setupHardware": [
        {
          "id": "usb-a-to-c-data-cable",
          "description": "Synthetic USB-A host to USB-C device data cable; declared demo audio path",
          "priceMinor": 500,
          "included": true
        }
      ]
    },
    {
      "id": "MIC-020-B",
      "productId": "MIC-020",
      "variantId": "MIC-020-DEMO",
      "sellerId": "DEMO-EXPRESS",
      "currency": "USD",
      "unitPriceMinor": 6800,
      "shippingMinor": 900,
      "otherFeesMinor": 500,
      "taxMinor": 0,
      "totalMinor": 8200,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-25T09:00:00+08:00",
        "latest": "2026-10-25T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 30 days of simulated delivery; item price refunded, outbound shipping excluded, USD 0 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle.",
        "Required demo setup hardware is included in otherFeesMinor and must be shown in the purchase summary."
      ],
      "evidenceIds": [
        "SELLER-EXPRESS",
        "FIXTURE-MIC-020-B"
      ],
      "classification": "proxy",
      "setupHardware": [
        {
          "id": "usb-a-to-c-data-cable",
          "description": "Synthetic USB-A host to USB-C device data cable; declared demo audio path",
          "priceMinor": 500,
          "included": true
        }
      ]
    },
    {
      "id": "MIC-022-A",
      "productId": "MIC-022",
      "variantId": "MIC-022-DEMO",
      "sellerId": "DEMO-VALUE",
      "currency": "USD",
      "unitPriceMinor": 10900,
      "shippingMinor": 500,
      "otherFeesMinor": 500,
      "taxMinor": 0,
      "totalMinor": 11900,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-28T09:00:00+08:00",
        "latest": "2026-10-28T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 14 days of simulated delivery; item price refunded, outbound shipping excluded, USD 5 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle.",
        "Required demo setup hardware is included in otherFeesMinor and must be shown in the purchase summary."
      ],
      "evidenceIds": [
        "SELLER-VALUE",
        "FIXTURE-MIC-022-A"
      ],
      "classification": "proxy",
      "setupHardware": [
        {
          "id": "usb-a-to-c-data-cable",
          "description": "Synthetic USB-A host to USB-C device data cable; declared demo audio path",
          "priceMinor": 500,
          "included": true
        }
      ]
    },
    {
      "id": "MIC-022-B",
      "productId": "MIC-022",
      "variantId": "MIC-022-DEMO",
      "sellerId": "DEMO-EXPRESS",
      "currency": "USD",
      "unitPriceMinor": 11900,
      "shippingMinor": 900,
      "otherFeesMinor": 500,
      "taxMinor": 0,
      "totalMinor": 13300,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-25T09:00:00+08:00",
        "latest": "2026-10-25T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 30 days of simulated delivery; item price refunded, outbound shipping excluded, USD 0 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle.",
        "Required demo setup hardware is included in otherFeesMinor and must be shown in the purchase summary."
      ],
      "evidenceIds": [
        "SELLER-EXPRESS",
        "FIXTURE-MIC-022-B"
      ],
      "classification": "proxy",
      "setupHardware": [
        {
          "id": "usb-a-to-c-data-cable",
          "description": "Synthetic USB-A host to USB-C device data cable; declared demo audio path",
          "priceMinor": 500,
          "included": true
        }
      ]
    },
    {
      "id": "MIC-025-A",
      "productId": "MIC-025",
      "variantId": "MIC-025-DEMO",
      "sellerId": "DEMO-VALUE",
      "currency": "USD",
      "unitPriceMinor": 5000,
      "shippingMinor": 500,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 5500,
      "availability": "unavailable",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-28T09:00:00+08:00",
        "latest": "2026-10-28T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 14 days of simulated delivery; item price refunded, outbound shipping excluded, USD 5 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-VALUE",
        "FIXTURE-MIC-025-A"
      ],
      "classification": "proxy",
      "setupHardware": []
    },
    {
      "id": "MIC-025-B",
      "productId": "MIC-025",
      "variantId": "MIC-025-DEMO",
      "sellerId": "DEMO-EXPRESS",
      "currency": "USD",
      "unitPriceMinor": 6000,
      "shippingMinor": 900,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 6900,
      "availability": "unavailable",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-25T09:00:00+08:00",
        "latest": "2026-10-25T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 30 days of simulated delivery; item price refunded, outbound shipping excluded, USD 0 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-EXPRESS",
        "FIXTURE-MIC-025-B"
      ],
      "classification": "proxy",
      "setupHardware": []
    },
    {
      "id": "MIC-037-A",
      "productId": "MIC-037",
      "variantId": "MIC-037-DEMO",
      "sellerId": "DEMO-VALUE",
      "currency": "USD",
      "unitPriceMinor": 8900,
      "shippingMinor": 500,
      "otherFeesMinor": 2000,
      "taxMinor": 0,
      "totalMinor": 11400,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-28T09:00:00+08:00",
        "latest": "2026-10-28T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 14 days of simulated delivery; item price refunded, outbound shipping excluded, USD 5 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle.",
        "Required demo setup hardware is included in otherFeesMinor and must be shown in the purchase summary."
      ],
      "evidenceIds": [
        "SELLER-VALUE",
        "FIXTURE-MIC-037-A"
      ],
      "classification": "proxy",
      "setupHardware": [
        {
          "id": "usb-c-trs-mic-interface",
          "description": "Synthetic USB-C interface with powered 3.5mm TRS microphone input; not a headphone-only adapter",
          "priceMinor": 2000,
          "included": true
        }
      ]
    },
    {
      "id": "MIC-037-B",
      "productId": "MIC-037",
      "variantId": "MIC-037-DEMO",
      "sellerId": "DEMO-EXPRESS",
      "currency": "USD",
      "unitPriceMinor": 9900,
      "shippingMinor": 900,
      "otherFeesMinor": 2000,
      "taxMinor": 0,
      "totalMinor": 12800,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-25T09:00:00+08:00",
        "latest": "2026-10-25T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 30 days of simulated delivery; item price refunded, outbound shipping excluded, USD 0 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle.",
        "Required demo setup hardware is included in otherFeesMinor and must be shown in the purchase summary."
      ],
      "evidenceIds": [
        "SELLER-EXPRESS",
        "FIXTURE-MIC-037-B"
      ],
      "classification": "proxy",
      "setupHardware": [
        {
          "id": "usb-c-trs-mic-interface",
          "description": "Synthetic USB-C interface with powered 3.5mm TRS microphone input; not a headphone-only adapter",
          "priceMinor": 2000,
          "included": true
        }
      ]
    },
    {
      "id": "MIC-038-A",
      "productId": "MIC-038",
      "variantId": "MIC-038-DEMO",
      "sellerId": "DEMO-VALUE",
      "currency": "USD",
      "unitPriceMinor": 5900,
      "shippingMinor": 500,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 6400,
      "availability": "out_of_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-28T09:00:00+08:00",
        "latest": "2026-10-28T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 14 days of simulated delivery; item price refunded, outbound shipping excluded, USD 5 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-VALUE",
        "FIXTURE-MIC-038-A"
      ],
      "classification": "proxy",
      "setupHardware": []
    },
    {
      "id": "MIC-038-B",
      "productId": "MIC-038",
      "variantId": "MIC-038-DEMO",
      "sellerId": "DEMO-EXPRESS",
      "currency": "USD",
      "unitPriceMinor": 6900,
      "shippingMinor": 900,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 7800,
      "availability": "out_of_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-25T09:00:00+08:00",
        "latest": "2026-10-25T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 30 days of simulated delivery; item price refunded, outbound shipping excluded, USD 0 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-EXPRESS",
        "FIXTURE-MIC-038-B"
      ],
      "classification": "proxy",
      "setupHardware": []
    },
    {
      "id": "MIC-040-A",
      "productId": "MIC-040",
      "variantId": "MIC-040-DEMO",
      "sellerId": "DEMO-VALUE",
      "currency": "USD",
      "unitPriceMinor": 14900,
      "shippingMinor": 500,
      "otherFeesMinor": 800,
      "taxMinor": 0,
      "totalMinor": 16200,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-28T09:00:00+08:00",
        "latest": "2026-10-28T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 14 days of simulated delivery; item price refunded, outbound shipping excluded, USD 5 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle.",
        "Required demo setup hardware is included in otherFeesMinor and must be shown in the purchase summary."
      ],
      "evidenceIds": [
        "SELLER-VALUE",
        "FIXTURE-MIC-040-A"
      ],
      "classification": "proxy",
      "setupHardware": [
        {
          "id": "usb-c-data-cable",
          "description": "Synthetic compatible USB data cable (not charge-only)",
          "priceMinor": 800,
          "included": true
        }
      ]
    },
    {
      "id": "MIC-040-B",
      "productId": "MIC-040",
      "variantId": "MIC-040-DEMO",
      "sellerId": "DEMO-EXPRESS",
      "currency": "USD",
      "unitPriceMinor": 15900,
      "shippingMinor": 900,
      "otherFeesMinor": 800,
      "taxMinor": 0,
      "totalMinor": 17600,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-25T09:00:00+08:00",
        "latest": "2026-10-25T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 30 days of simulated delivery; item price refunded, outbound shipping excluded, USD 0 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle.",
        "Required demo setup hardware is included in otherFeesMinor and must be shown in the purchase summary."
      ],
      "evidenceIds": [
        "SELLER-EXPRESS",
        "FIXTURE-MIC-040-B"
      ],
      "classification": "proxy",
      "setupHardware": [
        {
          "id": "usb-c-data-cable",
          "description": "Synthetic compatible USB data cable (not charge-only)",
          "priceMinor": 800,
          "included": true
        }
      ]
    },
    {
      "id": "MIC-044-A",
      "productId": "MIC-044",
      "variantId": "MIC-044-DEMO",
      "sellerId": "DEMO-VALUE",
      "currency": "USD",
      "unitPriceMinor": 10900,
      "shippingMinor": 500,
      "otherFeesMinor": 2000,
      "taxMinor": 0,
      "totalMinor": 13400,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-28T09:00:00+08:00",
        "latest": "2026-10-28T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 14 days of simulated delivery; item price refunded, outbound shipping excluded, USD 5 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle.",
        "Required demo setup hardware is included in otherFeesMinor and must be shown in the purchase summary."
      ],
      "evidenceIds": [
        "SELLER-VALUE",
        "FIXTURE-MIC-044-A"
      ],
      "classification": "proxy",
      "setupHardware": [
        {
          "id": "usb-c-data-cable",
          "description": "Synthetic compatible USB data cable (not charge-only)",
          "priceMinor": 800,
          "included": true
        },
        {
          "id": "desktop-mic-stand",
          "description": "Synthetic compatible desktop microphone stand",
          "priceMinor": 1200,
          "included": true
        }
      ]
    },
    {
      "id": "MIC-044-B",
      "productId": "MIC-044",
      "variantId": "MIC-044-DEMO",
      "sellerId": "DEMO-EXPRESS",
      "currency": "USD",
      "unitPriceMinor": 11900,
      "shippingMinor": 900,
      "otherFeesMinor": 2000,
      "taxMinor": 0,
      "totalMinor": 14800,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-25T09:00:00+08:00",
        "latest": "2026-10-25T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 30 days of simulated delivery; item price refunded, outbound shipping excluded, USD 0 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle.",
        "Required demo setup hardware is included in otherFeesMinor and must be shown in the purchase summary."
      ],
      "evidenceIds": [
        "SELLER-EXPRESS",
        "FIXTURE-MIC-044-B"
      ],
      "classification": "proxy",
      "setupHardware": [
        {
          "id": "usb-c-data-cable",
          "description": "Synthetic compatible USB data cable (not charge-only)",
          "priceMinor": 800,
          "included": true
        },
        {
          "id": "desktop-mic-stand",
          "description": "Synthetic compatible desktop microphone stand",
          "priceMinor": 1200,
          "included": true
        }
      ]
    },
    {
      "id": "MIC-047-A",
      "productId": "MIC-047",
      "variantId": "MIC-047-DEMO",
      "sellerId": "DEMO-VALUE",
      "currency": "USD",
      "unitPriceMinor": 5000,
      "shippingMinor": 500,
      "otherFeesMinor": 3200,
      "taxMinor": 0,
      "totalMinor": 8700,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-28T09:00:00+08:00",
        "latest": "2026-10-28T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 14 days of simulated delivery; item price refunded, outbound shipping excluded, USD 5 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle.",
        "Required demo setup hardware is included in otherFeesMinor and must be shown in the purchase summary."
      ],
      "evidenceIds": [
        "SELLER-VALUE",
        "FIXTURE-MIC-047-A"
      ],
      "classification": "proxy",
      "setupHardware": [
        {
          "id": "usb-c-trs-mic-interface",
          "description": "Synthetic USB-C interface with powered 3.5mm TRS microphone input; not a headphone-only adapter",
          "priceMinor": 2000,
          "included": true
        },
        {
          "id": "desktop-mic-stand",
          "description": "Synthetic compatible desktop microphone stand",
          "priceMinor": 1200,
          "included": true
        }
      ]
    },
    {
      "id": "MIC-047-B",
      "productId": "MIC-047",
      "variantId": "MIC-047-DEMO",
      "sellerId": "DEMO-EXPRESS",
      "currency": "USD",
      "unitPriceMinor": 6000,
      "shippingMinor": 900,
      "otherFeesMinor": 3200,
      "taxMinor": 0,
      "totalMinor": 10100,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-25T09:00:00+08:00",
        "latest": "2026-10-25T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 30 days of simulated delivery; item price refunded, outbound shipping excluded, USD 0 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle.",
        "Required demo setup hardware is included in otherFeesMinor and must be shown in the purchase summary."
      ],
      "evidenceIds": [
        "SELLER-EXPRESS",
        "FIXTURE-MIC-047-B"
      ],
      "classification": "proxy",
      "setupHardware": [
        {
          "id": "usb-c-trs-mic-interface",
          "description": "Synthetic USB-C interface with powered 3.5mm TRS microphone input; not a headphone-only adapter",
          "priceMinor": 2000,
          "included": true
        },
        {
          "id": "desktop-mic-stand",
          "description": "Synthetic compatible desktop microphone stand",
          "priceMinor": 1200,
          "included": true
        }
      ]
    },
    {
      "id": "BAG-001-A",
      "productId": "BAG-001",
      "variantId": "BAG-001-DEMO",
      "sellerId": "DEMO-VALUE",
      "currency": "USD",
      "unitPriceMinor": 9900,
      "shippingMinor": 500,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 10400,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-28T09:00:00+08:00",
        "latest": "2026-10-28T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 14 days of simulated delivery; item price refunded, outbound shipping excluded, USD 5 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-VALUE",
        "FIXTURE-BAG-001-A"
      ],
      "classification": "proxy",
      "setupHardware": []
    },
    {
      "id": "BAG-001-B",
      "productId": "BAG-001",
      "variantId": "BAG-001-DEMO",
      "sellerId": "DEMO-EXPRESS",
      "currency": "USD",
      "unitPriceMinor": 11000,
      "shippingMinor": 900,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 11900,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-25T09:00:00+08:00",
        "latest": "2026-10-25T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 30 days of simulated delivery; item price refunded, outbound shipping excluded, USD 0 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-EXPRESS",
        "FIXTURE-BAG-001-B"
      ],
      "classification": "proxy",
      "setupHardware": []
    },
    {
      "id": "BAG-002-A",
      "productId": "BAG-002",
      "variantId": "BAG-002-DEMO",
      "sellerId": "DEMO-VALUE",
      "currency": "USD",
      "unitPriceMinor": 7900,
      "shippingMinor": 500,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 8400,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-28T09:00:00+08:00",
        "latest": "2026-10-28T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 14 days of simulated delivery; item price refunded, outbound shipping excluded, USD 5 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-VALUE",
        "FIXTURE-BAG-002-A"
      ],
      "classification": "proxy",
      "setupHardware": []
    },
    {
      "id": "BAG-002-B",
      "productId": "BAG-002",
      "variantId": "BAG-002-DEMO",
      "sellerId": "DEMO-EXPRESS",
      "currency": "USD",
      "unitPriceMinor": 9500,
      "shippingMinor": 900,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 10400,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-25T09:00:00+08:00",
        "latest": "2026-10-25T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 30 days of simulated delivery; item price refunded, outbound shipping excluded, USD 0 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-EXPRESS",
        "FIXTURE-BAG-002-B"
      ],
      "classification": "proxy",
      "setupHardware": []
    },
    {
      "id": "BAG-003-A",
      "productId": "BAG-003",
      "variantId": "BAG-003-DEMO",
      "sellerId": "DEMO-VALUE",
      "currency": "USD",
      "unitPriceMinor": 6900,
      "shippingMinor": 500,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 7400,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-28T09:00:00+08:00",
        "latest": "2026-10-28T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 14 days of simulated delivery; item price refunded, outbound shipping excluded, USD 5 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-VALUE",
        "FIXTURE-BAG-003-A"
      ],
      "classification": "proxy",
      "setupHardware": []
    },
    {
      "id": "BAG-003-B",
      "productId": "BAG-003",
      "variantId": "BAG-003-DEMO",
      "sellerId": "DEMO-EXPRESS",
      "currency": "USD",
      "unitPriceMinor": 8000,
      "shippingMinor": 900,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 8900,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-25T09:00:00+08:00",
        "latest": "2026-10-25T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 30 days of simulated delivery; item price refunded, outbound shipping excluded, USD 0 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-EXPRESS",
        "FIXTURE-BAG-003-B"
      ],
      "classification": "proxy",
      "setupHardware": []
    },
    {
      "id": "BAG-004-A",
      "productId": "BAG-004",
      "variantId": "BAG-004-DEMO",
      "sellerId": "DEMO-VALUE",
      "currency": "USD",
      "unitPriceMinor": 7500,
      "shippingMinor": 500,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 8000,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-28T09:00:00+08:00",
        "latest": "2026-10-28T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 14 days of simulated delivery; item price refunded, outbound shipping excluded, USD 5 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-VALUE",
        "FIXTURE-BAG-004-A"
      ],
      "classification": "proxy",
      "setupHardware": []
    },
    {
      "id": "BAG-004-B",
      "productId": "BAG-004",
      "variantId": "BAG-004-DEMO",
      "sellerId": "DEMO-EXPRESS",
      "currency": "USD",
      "unitPriceMinor": 8500,
      "shippingMinor": 900,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 9400,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-25T09:00:00+08:00",
        "latest": "2026-10-25T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 30 days of simulated delivery; item price refunded, outbound shipping excluded, USD 0 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-EXPRESS",
        "FIXTURE-BAG-004-B"
      ],
      "classification": "proxy",
      "setupHardware": []
    },
    {
      "id": "BAG-005-A",
      "productId": "BAG-005",
      "variantId": "BAG-005-DEMO",
      "sellerId": "DEMO-VALUE",
      "currency": "USD",
      "unitPriceMinor": 9900,
      "shippingMinor": 500,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 10400,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-28T09:00:00+08:00",
        "latest": "2026-10-28T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 14 days of simulated delivery; item price refunded, outbound shipping excluded, USD 5 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-VALUE",
        "FIXTURE-BAG-005-A"
      ],
      "classification": "proxy",
      "setupHardware": []
    },
    {
      "id": "BAG-005-B",
      "productId": "BAG-005",
      "variantId": "BAG-005-DEMO",
      "sellerId": "DEMO-EXPRESS",
      "currency": "USD",
      "unitPriceMinor": 11000,
      "shippingMinor": 900,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 11900,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-25T09:00:00+08:00",
        "latest": "2026-10-25T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 30 days of simulated delivery; item price refunded, outbound shipping excluded, USD 0 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-EXPRESS",
        "FIXTURE-BAG-005-B"
      ],
      "classification": "proxy",
      "setupHardware": []
    },
    {
      "id": "BAG-006-A",
      "productId": "BAG-006",
      "variantId": "BAG-006-DEMO",
      "sellerId": "DEMO-VALUE",
      "currency": "USD",
      "unitPriceMinor": 7500,
      "shippingMinor": 500,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 8000,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-28T09:00:00+08:00",
        "latest": "2026-10-28T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 14 days of simulated delivery; item price refunded, outbound shipping excluded, USD 5 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-VALUE",
        "FIXTURE-BAG-006-A"
      ],
      "classification": "proxy",
      "setupHardware": []
    },
    {
      "id": "BAG-006-B",
      "productId": "BAG-006",
      "variantId": "BAG-006-DEMO",
      "sellerId": "DEMO-EXPRESS",
      "currency": "USD",
      "unitPriceMinor": 8500,
      "shippingMinor": 900,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 9400,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-25T09:00:00+08:00",
        "latest": "2026-10-25T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 30 days of simulated delivery; item price refunded, outbound shipping excluded, USD 0 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-EXPRESS",
        "FIXTURE-BAG-006-B"
      ],
      "classification": "proxy",
      "setupHardware": []
    },
    {
      "id": "BED-001-A",
      "productId": "BED-001",
      "variantId": "BED-001-DEMO",
      "sellerId": "DEMO-VALUE",
      "currency": "USD",
      "unitPriceMinor": 2999,
      "shippingMinor": 500,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 3499,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-28T09:00:00+08:00",
        "latest": "2026-10-28T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 14 days of simulated delivery; item price refunded, outbound shipping excluded, USD 5 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-VALUE",
        "FIXTURE-BED-001-A"
      ],
      "classification": "proxy",
      "setupHardware": []
    },
    {
      "id": "BED-001-B",
      "productId": "BED-001",
      "variantId": "BED-001-DEMO",
      "sellerId": "DEMO-EXPRESS",
      "currency": "USD",
      "unitPriceMinor": 3499,
      "shippingMinor": 900,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 4399,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-25T09:00:00+08:00",
        "latest": "2026-10-25T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 30 days of simulated delivery; item price refunded, outbound shipping excluded, USD 0 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-EXPRESS",
        "FIXTURE-BED-001-B"
      ],
      "classification": "proxy",
      "setupHardware": []
    },
    {
      "id": "BED-002-A",
      "productId": "BED-002",
      "variantId": "BED-002-DEMO",
      "sellerId": "DEMO-VALUE",
      "currency": "USD",
      "unitPriceMinor": 5999,
      "shippingMinor": 500,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 6499,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-28T09:00:00+08:00",
        "latest": "2026-10-28T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 14 days of simulated delivery; item price refunded, outbound shipping excluded, USD 5 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-VALUE",
        "FIXTURE-BED-002-A"
      ],
      "classification": "proxy",
      "setupHardware": []
    },
    {
      "id": "BED-002-B",
      "productId": "BED-002",
      "variantId": "BED-002-DEMO",
      "sellerId": "DEMO-EXPRESS",
      "currency": "USD",
      "unitPriceMinor": 6499,
      "shippingMinor": 900,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 7399,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-25T09:00:00+08:00",
        "latest": "2026-10-25T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 30 days of simulated delivery; item price refunded, outbound shipping excluded, USD 0 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-EXPRESS",
        "FIXTURE-BED-002-B"
      ],
      "classification": "proxy",
      "setupHardware": []
    },
    {
      "id": "BED-003-A",
      "productId": "BED-003",
      "variantId": "BED-003-DEMO",
      "sellerId": "DEMO-VALUE",
      "currency": "USD",
      "unitPriceMinor": 4999,
      "shippingMinor": 500,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 5499,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-28T09:00:00+08:00",
        "latest": "2026-10-28T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 14 days of simulated delivery; item price refunded, outbound shipping excluded, USD 5 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-VALUE",
        "FIXTURE-BED-003-A"
      ],
      "classification": "proxy",
      "setupHardware": []
    },
    {
      "id": "BED-003-B",
      "productId": "BED-003",
      "variantId": "BED-003-DEMO",
      "sellerId": "DEMO-EXPRESS",
      "currency": "USD",
      "unitPriceMinor": 5499,
      "shippingMinor": 900,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 6399,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-25T09:00:00+08:00",
        "latest": "2026-10-25T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 30 days of simulated delivery; item price refunded, outbound shipping excluded, USD 0 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-EXPRESS",
        "FIXTURE-BED-003-B"
      ],
      "classification": "proxy",
      "setupHardware": []
    },
    {
      "id": "BED-004-A",
      "productId": "BED-004",
      "variantId": "BED-004-DEMO",
      "sellerId": "DEMO-VALUE",
      "currency": "USD",
      "unitPriceMinor": 3999,
      "shippingMinor": 500,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 4499,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-28T09:00:00+08:00",
        "latest": "2026-10-28T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 14 days of simulated delivery; item price refunded, outbound shipping excluded, USD 5 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-VALUE",
        "FIXTURE-BED-004-A"
      ],
      "classification": "proxy",
      "setupHardware": []
    },
    {
      "id": "BED-004-B",
      "productId": "BED-004",
      "variantId": "BED-004-DEMO",
      "sellerId": "DEMO-EXPRESS",
      "currency": "USD",
      "unitPriceMinor": 4499,
      "shippingMinor": 900,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 5399,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-25T09:00:00+08:00",
        "latest": "2026-10-25T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 30 days of simulated delivery; item price refunded, outbound shipping excluded, USD 0 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-EXPRESS",
        "FIXTURE-BED-004-B"
      ],
      "classification": "proxy",
      "setupHardware": []
    },
    {
      "id": "BED-005-A",
      "productId": "BED-005",
      "variantId": "BED-005-DEMO",
      "sellerId": "DEMO-VALUE",
      "currency": "USD",
      "unitPriceMinor": 19900,
      "shippingMinor": 0,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 19900,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-28T09:00:00+08:00",
        "latest": "2026-10-28T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 14 days of simulated delivery; item price refunded, outbound shipping excluded, USD 5 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-VALUE",
        "FIXTURE-BED-005-A"
      ],
      "classification": "proxy",
      "setupHardware": []
    },
    {
      "id": "BED-005-B",
      "productId": "BED-005",
      "variantId": "BED-005-DEMO",
      "sellerId": "DEMO-EXPRESS",
      "currency": "USD",
      "unitPriceMinor": 20900,
      "shippingMinor": 900,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 21800,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-25T09:00:00+08:00",
        "latest": "2026-10-25T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 30 days of simulated delivery; item price refunded, outbound shipping excluded, USD 0 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-EXPRESS",
        "FIXTURE-BED-005-B"
      ],
      "classification": "proxy",
      "setupHardware": []
    },
    {
      "id": "BED-006-A",
      "productId": "BED-006",
      "variantId": "BED-006-DEMO",
      "sellerId": "DEMO-VALUE",
      "currency": "USD",
      "unitPriceMinor": 37900,
      "shippingMinor": 0,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 37900,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-28T09:00:00+08:00",
        "latest": "2026-10-28T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 14 days of simulated delivery; item price refunded, outbound shipping excluded, USD 5 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-VALUE",
        "FIXTURE-BED-006-A"
      ],
      "classification": "proxy",
      "setupHardware": []
    },
    {
      "id": "BED-006-B",
      "productId": "BED-006",
      "variantId": "BED-006-DEMO",
      "sellerId": "DEMO-EXPRESS",
      "currency": "USD",
      "unitPriceMinor": 38900,
      "shippingMinor": 900,
      "otherFeesMinor": 0,
      "taxMinor": 0,
      "totalMinor": 39800,
      "availability": "in_stock",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "deliveryWindow": {
        "earliest": "2026-10-25T09:00:00+08:00",
        "latest": "2026-10-25T18:00:00+08:00",
        "timezone": "Asia/Singapore"
      },
      "orderCutoff": "2026-10-24T12:00:00+08:00",
      "returnTerms": "DEMO: return unused/unwashed in original packaging within 30 days of simulated delivery; item price refunded, outbound shipping excluded, USD 0 return postage.",
      "conditions": [
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
        "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle."
      ],
      "evidenceIds": [
        "SELLER-EXPRESS",
        "FIXTURE-BED-006-B"
      ],
      "classification": "proxy",
      "setupHardware": []
    }
  ],
  "evidence": [
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-001",
      "checkedOn": "2026-10-24",
      "id": "SRC-MIC-001",
      "sourceUrl": "https://www.apple.com/shop/product/myqy3am/a/earpods-usb-c",
      "sourceType": "merchant",
      "classification": "snapshot",
      "claim": "Imported source specifications and variant notes: Price from Apple search result; stock and customer rating from Target, not Apple. Target lists a different price. Apple lists macOS Monterey 12.6+, iPadOS 16.4+, and iOS 17+ for the relevant USB-C devices."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-001",
      "checkedOn": "2026-10-24",
      "id": "FIT-MIC-001",
      "sourceUrl": null,
      "sourceType": "authored",
      "classification": "proxy",
      "claim": "Low-cost baseline for a laptop bag; keep the inline mic clear of clothing. Nearby speech can still interfere."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-001",
      "checkedOn": "2026-10-24",
      "id": "COMPAT-MIC-001",
      "sourceUrl": null,
      "sourceType": "fixture",
      "classification": "proxy",
      "claim": "Bounded demo audio path; includes the declared setup hardware. Not a measured compatibility or dictation benchmark."
    },
    {
      "rating": 4.35,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": "Target product aggregate; price / inventory may differ from Apple",
      "subjectType": "product",
      "subjectId": "MIC-001",
      "checkedOn": "2026-10-24",
      "id": "REV-MIC-001",
      "sourceUrl": "https://www.target.com/p/-/A-89827259",
      "sourceType": "review",
      "classification": "snapshot",
      "claim": "Source aggregate/count captured; individual review text not captured."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-003",
      "checkedOn": "2026-10-24",
      "id": "SRC-MIC-003",
      "sourceUrl": "https://www.logitech.com/en-us/shop/p/h390-usb-headset",
      "sourceType": "merchant",
      "classification": "snapshot",
      "claim": "Imported source specifications and variant notes: Current search result shows a sale price of $21.99 versus $24.99; page extraction returned a server error. USB-C is a separate selectable variant."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-003",
      "checkedOn": "2026-10-24",
      "id": "FIT-MIC-003",
      "sourceUrl": null,
      "sourceType": "authored",
      "classification": "proxy",
      "claim": "Useful budget starting point: the boom keeps speech close while leaving both hands free."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-003",
      "checkedOn": "2026-10-24",
      "id": "COMPAT-MIC-003",
      "sourceUrl": null,
      "sourceType": "fixture",
      "classification": "proxy",
      "claim": "Bounded demo audio path; includes the declared setup hardware. Not a measured compatibility or dictation benchmark."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-009",
      "checkedOn": "2026-10-24",
      "id": "SRC-MIC-009",
      "sourceUrl": "https://www.lenovo.com/us/en/p/accessories-and-software/audio/headsets/78806811",
      "sourceType": "merchant",
      "classification": "snapshot",
      "claim": "Imported source specifications and variant notes: Search result shows $277 versus $378. Fetched Lenovo page did not expose price or stock. Manufacturer specifications: [Additional source](https://www.jabra.com/_/media/Jabra_VXi_Product-Documentation/Jabra-Evolve2-65-Flex/Technical-specifications/RevA/EN-Jabra-Evolve2-65-Flex-Tech-Spec-24042023.pdf)"
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-009",
      "checkedOn": "2026-10-24",
      "id": "FIT-MIC-009",
      "sourceUrl": null,
      "sourceType": "authored",
      "classification": "proxy",
      "claim": "Portable premium headset candidate for café prompting; keep the boom correctly positioned."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-009",
      "checkedOn": "2026-10-24",
      "id": "COMPAT-MIC-009",
      "sourceUrl": null,
      "sourceType": "fixture",
      "classification": "proxy",
      "claim": "Bounded demo audio path; includes the declared setup hardware. Not a measured compatibility or dictation benchmark."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-015",
      "checkedOn": "2026-10-24",
      "id": "SRC-MIC-015",
      "sourceUrl": "https://www.sweetwater.com/store/detail/MV6G2K--shure-mv6-gen-2-usb-gaming-microphone-black",
      "sourceType": "merchant",
      "classification": "snapshot",
      "claim": "Imported source specifications and variant notes: Original MV6 URL redirected to Gen 2. Recorded model and price follow the final page; no original-MV6 reviews transferred."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-015",
      "checkedOn": "2026-10-24",
      "id": "FIT-MIC-015",
      "sourceUrl": null,
      "sourceType": "authored",
      "classification": "proxy",
      "claim": "Easy USB desk candidate for prompting; place it close enough that the voice dominates the café."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-015",
      "checkedOn": "2026-10-24",
      "id": "COMPAT-MIC-015",
      "sourceUrl": null,
      "sourceType": "fixture",
      "classification": "proxy",
      "claim": "Bounded demo audio path; includes the declared setup hardware. Not a measured compatibility or dictation benchmark."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-020",
      "checkedOn": "2026-10-24",
      "id": "SRC-MIC-020",
      "sourceUrl": "https://fifinemicrophone.com/collections/microphones/products/fifine-ampligame-am8-microphone",
      "sourceType": "merchant",
      "classification": "snapshot",
      "claim": "Imported source specifications and variant notes: Price is AM8 base package, not AM8T boom kit or AM8PLUS. A generic back-in-stock widget does not establish current stock."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-020",
      "checkedOn": "2026-10-24",
      "id": "FIT-MIC-020",
      "sourceUrl": null,
      "sourceType": "authored",
      "classification": "proxy",
      "claim": "Low-cost dynamic desk option; keep it near the mouth and check stand height."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-020",
      "checkedOn": "2026-10-24",
      "id": "COMPAT-MIC-020",
      "sourceUrl": null,
      "sourceType": "fixture",
      "classification": "proxy",
      "claim": "Bounded demo audio path; includes the declared setup hardware. Not a measured compatibility or dictation benchmark."
    },
    {
      "rating": 4.8,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": "Brand-store aggregate; variant grouping not independently established",
      "subjectType": "product",
      "subjectId": "MIC-020",
      "checkedOn": "2026-10-24",
      "id": "REV-MIC-020",
      "sourceUrl": "https://fifinemicrophone.com/collections/microphones/products/fifine-ampligame-am8-microphone",
      "sourceType": "review",
      "classification": "snapshot",
      "claim": "Source aggregate/count captured; individual review text not captured."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-022",
      "checkedOn": "2026-10-24",
      "id": "SRC-MIC-022",
      "sourceUrl": "https://www.sweetwater.com/store/detail/NTUSBMini--rode-nt-usb-mini-usb-condenser-microphone",
      "sourceType": "merchant",
      "classification": "snapshot",
      "claim": "Imported source specifications and variant notes: Live page reports $109 in stock, superseding an indexed backorder result."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-022",
      "checkedOn": "2026-10-24",
      "id": "FIT-MIC-022",
      "sourceUrl": null,
      "sourceType": "authored",
      "classification": "proxy",
      "claim": "Compact and simple for a quieter desk; head movement and distant placement can admit more room sound."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-022",
      "checkedOn": "2026-10-24",
      "id": "COMPAT-MIC-022",
      "sourceUrl": null,
      "sourceType": "fixture",
      "classification": "proxy",
      "claim": "Bounded demo audio path; includes the declared setup hardware. Not a measured compatibility or dictation benchmark."
    },
    {
      "rating": 4.7,
      "ratingCount": 22,
      "writtenReviewCount": 22,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": "Rendered customer reviews",
      "subjectType": "product",
      "subjectId": "MIC-022",
      "checkedOn": "2026-10-24",
      "id": "REV-MIC-022",
      "sourceUrl": "https://www.sweetwater.com/store/detail/NTUSBMini--rode-nt-usb-mini-usb-condenser-microphone/reviews",
      "sourceType": "review",
      "classification": "snapshot",
      "claim": "Visible reviews praise clear sound, compact design, and the magnetic stand; some users report less satisfactory sound or gain."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-025",
      "checkedOn": "2026-10-24",
      "id": "SRC-MIC-025",
      "sourceUrl": "https://www.logitechg.com/en-us/shop/p/snowball-ice-usb-microphone",
      "sourceType": "merchant",
      "classification": "snapshot",
      "claim": "Imported source specifications and variant notes: Official page lists $49.99 and Not available; this is the iCE, not the multipattern Snowball."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-025",
      "checkedOn": "2026-10-24",
      "id": "FIT-MIC-025",
      "sourceUrl": null,
      "sourceType": "authored",
      "classification": "proxy",
      "claim": "Low-cost legacy consumer example for the catalog; modest positioning flexibility on the stock tripod."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-025",
      "checkedOn": "2026-10-24",
      "id": "COMPAT-MIC-025",
      "sourceUrl": null,
      "sourceType": "fixture",
      "classification": "proxy",
      "claim": "Bounded demo audio path; includes the declared setup hardware. Not a measured compatibility or dictation benchmark."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-037",
      "checkedOn": "2026-10-24",
      "id": "SRC-MIC-037",
      "sourceUrl": "https://www.sweetwater.com/store/detail/LavalierGO--rode-lavalier-go-professional-wearable-microphone",
      "sourceType": "merchant",
      "classification": "snapshot",
      "claim": "Imported source specifications and variant notes: Mic-only accessory. It is not itself wireless, and its TRS plug is not the same as smartLav+ TRRS."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-037",
      "checkedOn": "2026-10-24",
      "id": "FIT-MIC-037",
      "sourceUrl": null,
      "sourceType": "authored",
      "classification": "proxy",
      "claim": "Discrete wired lavalier; the laptop must have a suitable powered mic input or adapter."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-037",
      "checkedOn": "2026-10-24",
      "id": "COMPAT-MIC-037",
      "sourceUrl": null,
      "sourceType": "fixture",
      "classification": "proxy",
      "claim": "Bounded demo audio path; includes the declared setup hardware. Not a measured compatibility or dictation benchmark."
    },
    {
      "rating": 5,
      "ratingCount": 7,
      "writtenReviewCount": 7,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": "Rendered customer reviews",
      "subjectType": "product",
      "subjectId": "MIC-037",
      "checkedOn": "2026-10-24",
      "id": "REV-MIC-037",
      "sourceUrl": "https://www.sweetwater.com/store/detail/LavalierGO--rode-lavalier-go-professional-wearable-microphone/reviews",
      "sourceType": "review",
      "classification": "snapshot",
      "claim": "Visible reviews praise small size and voice sound; one notes self-noise and another warns about laptop combo-port compatibility."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-038",
      "checkedOn": "2026-10-24",
      "id": "SRC-MIC-038",
      "sourceUrl": "https://store.dji.com/product/dji-mic-mini",
      "sourceType": "merchant",
      "classification": "snapshot",
      "claim": "Imported source specifications and variant notes: Search result explicitly maps $59 to 1 TX + 1 RX. Fetched page defaults to $99 two-TX kit; all options were marked out of stock. No charging case assumed in the $59 kit."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-038",
      "checkedOn": "2026-10-24",
      "id": "FIT-MIC-038",
      "sourceUrl": null,
      "sourceType": "authored",
      "classification": "proxy",
      "claim": "Tiny portable clip-on candidate; compare receiver audio with direct Bluetooth before using it for prompts."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-038",
      "checkedOn": "2026-10-24",
      "id": "COMPAT-MIC-038",
      "sourceUrl": null,
      "sourceType": "fixture",
      "classification": "proxy",
      "claim": "Bounded demo audio path; includes the declared setup hardware. Not a measured compatibility or dictation benchmark."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-040",
      "checkedOn": "2026-10-24",
      "id": "SRC-MIC-040",
      "sourceUrl": "https://www.sweetwater.com/store/detail/WirelessME--rode-wireless-me-clip-on-wireless-microphone-system",
      "sourceType": "merchant",
      "classification": "snapshot",
      "claim": "Imported source specifications and variant notes: One transmitter plus receiver; receiver also has a mic. GainAssist is automatic level control, not equivalent to background-noise cancellation."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-040",
      "checkedOn": "2026-10-24",
      "id": "FIT-MIC-040",
      "sourceUrl": null,
      "sourceType": "authored",
      "classification": "proxy",
      "claim": "Easy portable option; disable or exclude receiver-side ME Mic when only the wearer should be transcribed."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-040",
      "checkedOn": "2026-10-24",
      "id": "COMPAT-MIC-040",
      "sourceUrl": null,
      "sourceType": "fixture",
      "classification": "proxy",
      "claim": "Bounded demo audio path; includes the declared setup hardware. Not a measured compatibility or dictation benchmark."
    },
    {
      "rating": 4.8,
      "ratingCount": 4,
      "writtenReviewCount": 4,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": "Rendered customer reviews",
      "subjectType": "product",
      "subjectId": "MIC-040",
      "checkedOn": "2026-10-24",
      "id": "REV-MIC-040",
      "sourceUrl": "https://www.sweetwater.com/store/detail/WirelessME--rode-wireless-me-clip-on-wireless-microphone-system/reviews",
      "sourceType": "review",
      "classification": "snapshot",
      "claim": "Visible reviews praise simple mobile setup; one reports relatively fast battery discharge."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-044",
      "checkedOn": "2026-10-24",
      "id": "SRC-MIC-044",
      "sourceUrl": "https://www.sweetwater.com/store/detail/VideoMicGo2H--rode-videomic-go-ii-camera-mounted-shotgun-microphone",
      "sourceType": "merchant",
      "classification": "snapshot",
      "claim": "Imported source specifications and variant notes: Price is the listed Helix-mount package; USB cable / desktop mount requirements depend on package."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-044",
      "checkedOn": "2026-10-24",
      "id": "FIT-MIC-044",
      "sourceUrl": null,
      "sourceType": "authored",
      "classification": "proxy",
      "claim": "Lightweight directional option; bring it close to the speaker instead of treating it as an across-room mic."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-044",
      "checkedOn": "2026-10-24",
      "id": "COMPAT-MIC-044",
      "sourceUrl": null,
      "sourceType": "fixture",
      "classification": "proxy",
      "claim": "Bounded demo audio path; includes the declared setup hardware. Not a measured compatibility or dictation benchmark."
    },
    {
      "rating": 5,
      "ratingCount": 2,
      "writtenReviewCount": 2,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": "Rendered customer reviews",
      "subjectType": "product",
      "subjectId": "MIC-044",
      "checkedOn": "2026-10-24",
      "id": "REV-MIC-044",
      "sourceUrl": "https://www.sweetwater.com/store/detail/VideoMicGo2H--rode-videomic-go-ii-camera-mounted-shotgun-microphone/reviews",
      "sourceType": "review",
      "classification": "snapshot",
      "claim": "Two visible reviews praise audio and mounting; one explicitly says machinery noise was still captured."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-047",
      "checkedOn": "2026-10-24",
      "id": "SRC-MIC-047",
      "sourceUrl": "https://shop.deitymic.com/products/d4-mini",
      "sourceType": "merchant",
      "classification": "snapshot",
      "claim": "Imported source specifications and variant notes: Official shop lists $49.95 in stock and 43 reviews. No aggregate star rating was exposed; a histogram was not converted into an official score."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-047",
      "checkedOn": "2026-10-24",
      "id": "FIT-MIC-047",
      "sourceUrl": null,
      "sourceType": "authored",
      "classification": "proxy",
      "claim": "Low-cost directional demo option; ensure the adapter supplies microphone plug-in power."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "subjectType": "product",
      "subjectId": "MIC-047",
      "checkedOn": "2026-10-24",
      "id": "COMPAT-MIC-047",
      "sourceUrl": null,
      "sourceType": "fixture",
      "classification": "proxy",
      "claim": "Bounded demo audio path; includes the declared setup hardware. Not a measured compatibility or dictation benchmark."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": 43,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": "Shop review count; aggregate score not exposed",
      "subjectType": "product",
      "subjectId": "MIC-047",
      "checkedOn": "2026-10-24",
      "id": "REV-MIC-047",
      "sourceUrl": "https://shop.deitymic.com/products/d4-mini",
      "sourceType": "review",
      "classification": "snapshot",
      "claim": "Source aggregate/count captured; individual review text not captured."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "SRC-BAG-001",
      "subjectType": "product",
      "subjectId": "BAG-001",
      "sourceUrl": "https://www.osprey.com/daylitetm-large-tote-pack",
      "sourceType": "manufacturer",
      "checkedOn": "2026-10-24",
      "classification": "snapshot",
      "claim": "Product specifications transcribed into specs; unknown fields remain null. Reference prices are not payable offers and stock is unverified."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "DEMO-BAG-001",
      "subjectType": "product",
      "subjectId": "BAG-001",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Neutral demo color and generic illustration are authored fixtures, not a verified retail color SKU or photograph."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "SRC-BAG-002",
      "subjectType": "product",
      "subjectId": "BAG-002",
      "sourceUrl": "https://www.osprey.com/daylite-tote-pack-daylttotpks21-779?color=Tumbleweed+Yellow%2FTunnel+Vision&size=O%2FS",
      "sourceType": "manufacturer",
      "checkedOn": "2026-10-24",
      "classification": "snapshot",
      "claim": "Product specifications transcribed into specs; unknown fields remain null. Reference prices are not payable offers and stock is unverified."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "DEMO-BAG-002",
      "subjectType": "product",
      "subjectId": "BAG-002",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Neutral demo color and generic illustration are authored fixtures, not a verified retail color SKU or photograph."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "SRC-BAG-003",
      "subjectType": "product",
      "subjectId": "BAG-003",
      "sourceUrl": "https://www.osprey.com/daylitetm-messenger",
      "sourceType": "manufacturer",
      "checkedOn": "2026-10-24",
      "classification": "snapshot",
      "claim": "Product specifications transcribed into specs; unknown fields remain null. Reference prices are not payable offers and stock is unverified."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "DEMO-BAG-003",
      "subjectType": "product",
      "subjectId": "BAG-003",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Neutral demo color and generic illustration are authored fixtures, not a verified retail color SKU or photograph."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "SRC-BAG-004",
      "subjectType": "product",
      "subjectId": "BAG-004",
      "sourceUrl": "https://www.osprey.com/daylitetm-duffel-30",
      "sourceType": "manufacturer",
      "checkedOn": "2026-10-24",
      "classification": "snapshot",
      "claim": "Product specifications transcribed into specs; unknown fields remain null. Reference prices are not payable offers and stock is unverified."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "DEMO-BAG-004",
      "subjectType": "product",
      "subjectId": "BAG-004",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Neutral demo color and generic illustration are authored fixtures, not a verified retail color SKU or photograph."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "SRC-BAG-005",
      "subjectType": "product",
      "subjectId": "BAG-005",
      "sourceUrl": "https://www.osprey.com/daylitetm-expandable-travel-pack-26-6",
      "sourceType": "manufacturer",
      "checkedOn": "2026-10-24",
      "classification": "snapshot",
      "claim": "Product specifications transcribed into specs; unknown fields remain null. Reference prices are not payable offers and stock is unverified."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "DEMO-BAG-005",
      "subjectType": "product",
      "subjectId": "BAG-005",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Neutral demo color and generic illustration are authored fixtures, not a verified retail color SKU or photograph."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "SRC-BAG-006",
      "subjectType": "product",
      "subjectId": "BAG-006",
      "sourceUrl": "https://www.osprey.com/daylitetm-plus-driftshade-backpack",
      "sourceType": "manufacturer",
      "checkedOn": "2026-10-24",
      "classification": "snapshot",
      "claim": "Product specifications transcribed into specs; unknown fields remain null. Reference prices are not payable offers and stock is unverified."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "DEMO-BAG-006",
      "subjectType": "product",
      "subjectId": "BAG-006",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Neutral demo color and generic illustration are authored fixtures, not a verified retail color SKU or photograph."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "SRC-BED-001",
      "subjectType": "product",
      "subjectId": "BED-001",
      "sourceUrl": "https://www.ikea.com/us/en/p/dvala-sheet-set-white-70577531/",
      "sourceType": "merchant",
      "checkedOn": "2026-10-24",
      "classification": "snapshot",
      "claim": "Product specifications transcribed into specs; unknown fields remain null. Reference prices are not payable offers and stock is unverified."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "DEMO-BED-001",
      "subjectType": "product",
      "subjectId": "BED-001",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Simulation uses the sourced Queen size, color, and package contents with an authored illustration and separate fictional seller offers."
    },
    {
      "rating": 3.6,
      "ratingCount": null,
      "writtenReviewCount": 247,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": "Product-family aggregate includes other colors; exact-size grouping unverified. Count labelled Total reviews; ratingCount not separately exposed.",
      "id": "REV-BED-001",
      "subjectType": "product",
      "subjectId": "BED-001",
      "sourceUrl": "https://www.ikea.com/us/en/p/dvala-sheet-set-white-70577531/",
      "sourceType": "review",
      "checkedOn": "2026-10-24",
      "classification": "snapshot",
      "claim": "Paraphrase of inspected feedback, not a quotation: Some reviewers praise value and post-wash softness; others report roughness or a loose fit."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "SRC-BED-002",
      "subjectType": "product",
      "subjectId": "BED-002",
      "sourceUrl": "https://www.ikea.com/us/en/p/nattjasmin-sheet-set-white-00601153/",
      "sourceType": "merchant",
      "checkedOn": "2026-10-24",
      "classification": "snapshot",
      "claim": "Product specifications transcribed into specs; unknown fields remain null. Reference prices are not payable offers and stock is unverified."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "DEMO-BED-002",
      "subjectType": "product",
      "subjectId": "BED-002",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Simulation uses the sourced Queen size, color, and package contents with an authored illustration and separate fictional seller offers."
    },
    {
      "rating": 4.3,
      "ratingCount": null,
      "writtenReviewCount": 47,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": "Product-family aggregate includes other colors; exact-size grouping unverified. Count labelled Total reviews; ratingCount not separately exposed.",
      "id": "REV-BED-002",
      "subjectType": "product",
      "subjectId": "BED-002",
      "sourceUrl": "https://www.ikea.com/us/en/p/nattjasmin-sheet-set-white-00601153/",
      "sourceType": "review",
      "checkedOn": "2026-10-24",
      "classification": "snapshot",
      "claim": "Paraphrase of inspected feedback, not a quotation: Some reviewers praise smoothness; others describe inconsistent fitted-sheet fit."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "SRC-BED-003",
      "subjectType": "product",
      "subjectId": "BED-003",
      "sourceUrl": "https://www.ikea.com/us/en/p/ullvide-sheet-set-white-90577511/",
      "sourceType": "merchant",
      "checkedOn": "2026-10-24",
      "classification": "snapshot",
      "claim": "Product specifications transcribed into specs; unknown fields remain null. Reference prices are not payable offers and stock is unverified."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "DEMO-BED-003",
      "subjectType": "product",
      "subjectId": "BED-003",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Simulation uses the sourced Queen size, color, and package contents with an authored illustration and separate fictional seller offers."
    },
    {
      "rating": 4,
      "ratingCount": null,
      "writtenReviewCount": 41,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": "Product-family aggregate includes other colors; exact-size grouping unverified. Count labelled Total reviews; ratingCount not separately exposed.",
      "id": "REV-BED-003",
      "subjectType": "product",
      "subjectId": "BED-003",
      "sourceUrl": "https://www.ikea.com/us/en/p/ullvide-sheet-set-white-90577511/",
      "sourceType": "review",
      "checkedOn": "2026-10-24",
      "classification": "snapshot",
      "claim": "Paraphrase of inspected feedback, not a quotation: Inspected comments praise colors and smooth feel; no recurring complaint was established in the captured excerpt."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "SRC-BED-004",
      "subjectType": "product",
      "subjectId": "BED-004",
      "sourceUrl": "https://www.ikea.com/us/en/p/solfibbla-sheet-set-white-green-stripe-60615835/",
      "sourceType": "merchant",
      "checkedOn": "2026-10-24",
      "classification": "snapshot",
      "claim": "Product specifications transcribed into specs; unknown fields remain null. Reference prices are not payable offers and stock is unverified."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "DEMO-BED-004",
      "subjectType": "product",
      "subjectId": "BED-004",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Simulation uses the sourced Queen size, color, and package contents with an authored illustration and separate fictional seller offers."
    },
    {
      "rating": 3.7,
      "ratingCount": null,
      "writtenReviewCount": 56,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": "Product-family aggregate includes other colors; exact-size grouping unverified. Count labelled Total reviews; ratingCount not separately exposed.",
      "id": "REV-BED-004",
      "subjectType": "product",
      "subjectId": "BED-004",
      "sourceUrl": "https://www.ikea.com/us/en/p/solfibbla-sheet-set-white-green-stripe-60615835/",
      "sourceType": "review",
      "checkedOn": "2026-10-24",
      "classification": "snapshot",
      "claim": "Paraphrase of inspected feedback, not a quotation: Comfort feedback is mixed; individual complaints mention roughness, shrinkage, or damage on arrival."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "SRC-BED-005",
      "subjectType": "product",
      "subjectId": "BED-005",
      "sourceUrl": "https://www.brooklinen.com/products/classic-core-sheet-set",
      "sourceType": "manufacturer",
      "checkedOn": "2026-10-24",
      "classification": "snapshot",
      "claim": "Product specifications transcribed into specs; unknown fields remain null. Reference prices are not payable offers and stock is unverified."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "DEMO-BED-005",
      "subjectType": "product",
      "subjectId": "BED-005",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "White and four-piece package are demo assumptions only; retail package contents and selected-variant price remain unverified."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "SRC-BED-006",
      "subjectType": "product",
      "subjectId": "BED-006",
      "sourceUrl": "https://www.brooklinen.com/products/washed-linen-core-sheet-set",
      "sourceType": "manufacturer",
      "checkedOn": "2026-10-24",
      "classification": "snapshot",
      "claim": "Product specifications transcribed into specs; unknown fields remain null. Reference prices are not payable offers and stock is unverified."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "DEMO-BED-006",
      "subjectType": "product",
      "subjectId": "BED-006",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "White and four-piece package are demo assumptions only; retail package contents and selected-variant price remain unverified."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "SELLER-VALUE",
      "subjectType": "seller",
      "subjectId": "DEMO-VALUE",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored fulfillment fixture only. No real seller reviews, purchase counts, reputation or stock are asserted."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "SELLER-EXPRESS",
      "subjectType": "seller",
      "subjectId": "DEMO-EXPRESS",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored fulfillment fixture only. No real seller reviews, purchase counts, reputation or stock are asserted."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-MIC-001-A",
      "subjectType": "seller",
      "subjectId": "DEMO-VALUE",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored MIC-001-A: MIC-001-DEMO, USD 1900 item cents + 500 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-MIC-001-B",
      "subjectType": "seller",
      "subjectId": "DEMO-EXPRESS",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored MIC-001-B: MIC-001-DEMO, USD 2400 item cents + 900 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-MIC-003-A",
      "subjectType": "seller",
      "subjectId": "DEMO-VALUE",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored MIC-003-A: MIC-003-DEMO, USD 2200 item cents + 500 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-MIC-003-B",
      "subjectType": "seller",
      "subjectId": "DEMO-EXPRESS",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored MIC-003-B: MIC-003-DEMO, USD 2900 item cents + 900 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-MIC-009-A",
      "subjectType": "seller",
      "subjectId": "DEMO-VALUE",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored MIC-009-A: MIC-009-DEMO, USD 27700 item cents + 500 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-MIC-009-B",
      "subjectType": "seller",
      "subjectId": "DEMO-EXPRESS",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored MIC-009-B: MIC-009-DEMO, USD 28700 item cents + 900 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-MIC-015-A",
      "subjectType": "seller",
      "subjectId": "DEMO-VALUE",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored MIC-015-A: MIC-015-DEMO, USD 16900 item cents + 500 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-MIC-015-B",
      "subjectType": "seller",
      "subjectId": "DEMO-EXPRESS",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored MIC-015-B: MIC-015-DEMO, USD 17900 item cents + 900 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-MIC-020-A",
      "subjectType": "seller",
      "subjectId": "DEMO-VALUE",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored MIC-020-A: MIC-020-DEMO, USD 5800 item cents + 500 shipping cents + 500 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-MIC-020-B",
      "subjectType": "seller",
      "subjectId": "DEMO-EXPRESS",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored MIC-020-B: MIC-020-DEMO, USD 6800 item cents + 900 shipping cents + 500 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-MIC-022-A",
      "subjectType": "seller",
      "subjectId": "DEMO-VALUE",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored MIC-022-A: MIC-022-DEMO, USD 10900 item cents + 500 shipping cents + 500 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-MIC-022-B",
      "subjectType": "seller",
      "subjectId": "DEMO-EXPRESS",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored MIC-022-B: MIC-022-DEMO, USD 11900 item cents + 900 shipping cents + 500 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-MIC-025-A",
      "subjectType": "seller",
      "subjectId": "DEMO-VALUE",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored MIC-025-A: MIC-025-DEMO, USD 5000 item cents + 500 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-MIC-025-B",
      "subjectType": "seller",
      "subjectId": "DEMO-EXPRESS",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored MIC-025-B: MIC-025-DEMO, USD 6000 item cents + 900 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-MIC-037-A",
      "subjectType": "seller",
      "subjectId": "DEMO-VALUE",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored MIC-037-A: MIC-037-DEMO, USD 8900 item cents + 500 shipping cents + 2000 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-MIC-037-B",
      "subjectType": "seller",
      "subjectId": "DEMO-EXPRESS",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored MIC-037-B: MIC-037-DEMO, USD 9900 item cents + 900 shipping cents + 2000 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-MIC-038-A",
      "subjectType": "seller",
      "subjectId": "DEMO-VALUE",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored MIC-038-A: MIC-038-DEMO, USD 5900 item cents + 500 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-MIC-038-B",
      "subjectType": "seller",
      "subjectId": "DEMO-EXPRESS",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored MIC-038-B: MIC-038-DEMO, USD 6900 item cents + 900 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-MIC-040-A",
      "subjectType": "seller",
      "subjectId": "DEMO-VALUE",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored MIC-040-A: MIC-040-DEMO, USD 14900 item cents + 500 shipping cents + 800 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-MIC-040-B",
      "subjectType": "seller",
      "subjectId": "DEMO-EXPRESS",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored MIC-040-B: MIC-040-DEMO, USD 15900 item cents + 900 shipping cents + 800 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-MIC-044-A",
      "subjectType": "seller",
      "subjectId": "DEMO-VALUE",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored MIC-044-A: MIC-044-DEMO, USD 10900 item cents + 500 shipping cents + 2000 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-MIC-044-B",
      "subjectType": "seller",
      "subjectId": "DEMO-EXPRESS",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored MIC-044-B: MIC-044-DEMO, USD 11900 item cents + 900 shipping cents + 2000 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-MIC-047-A",
      "subjectType": "seller",
      "subjectId": "DEMO-VALUE",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored MIC-047-A: MIC-047-DEMO, USD 5000 item cents + 500 shipping cents + 3200 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-MIC-047-B",
      "subjectType": "seller",
      "subjectId": "DEMO-EXPRESS",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored MIC-047-B: MIC-047-DEMO, USD 6000 item cents + 900 shipping cents + 3200 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-BAG-001-A",
      "subjectType": "seller",
      "subjectId": "DEMO-VALUE",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored BAG-001-A: BAG-001-DEMO, USD 9900 item cents + 500 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-BAG-001-B",
      "subjectType": "seller",
      "subjectId": "DEMO-EXPRESS",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored BAG-001-B: BAG-001-DEMO, USD 11000 item cents + 900 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-BAG-002-A",
      "subjectType": "seller",
      "subjectId": "DEMO-VALUE",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored BAG-002-A: BAG-002-DEMO, USD 7900 item cents + 500 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-BAG-002-B",
      "subjectType": "seller",
      "subjectId": "DEMO-EXPRESS",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored BAG-002-B: BAG-002-DEMO, USD 9500 item cents + 900 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-BAG-003-A",
      "subjectType": "seller",
      "subjectId": "DEMO-VALUE",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored BAG-003-A: BAG-003-DEMO, USD 6900 item cents + 500 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-BAG-003-B",
      "subjectType": "seller",
      "subjectId": "DEMO-EXPRESS",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored BAG-003-B: BAG-003-DEMO, USD 8000 item cents + 900 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-BAG-004-A",
      "subjectType": "seller",
      "subjectId": "DEMO-VALUE",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored BAG-004-A: BAG-004-DEMO, USD 7500 item cents + 500 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-BAG-004-B",
      "subjectType": "seller",
      "subjectId": "DEMO-EXPRESS",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored BAG-004-B: BAG-004-DEMO, USD 8500 item cents + 900 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-BAG-005-A",
      "subjectType": "seller",
      "subjectId": "DEMO-VALUE",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored BAG-005-A: BAG-005-DEMO, USD 9900 item cents + 500 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-BAG-005-B",
      "subjectType": "seller",
      "subjectId": "DEMO-EXPRESS",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored BAG-005-B: BAG-005-DEMO, USD 11000 item cents + 900 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-BAG-006-A",
      "subjectType": "seller",
      "subjectId": "DEMO-VALUE",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored BAG-006-A: BAG-006-DEMO, USD 7500 item cents + 500 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-BAG-006-B",
      "subjectType": "seller",
      "subjectId": "DEMO-EXPRESS",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored BAG-006-B: BAG-006-DEMO, USD 8500 item cents + 900 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-BED-001-A",
      "subjectType": "seller",
      "subjectId": "DEMO-VALUE",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored BED-001-A: BED-001-DEMO, USD 2999 item cents + 500 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-BED-001-B",
      "subjectType": "seller",
      "subjectId": "DEMO-EXPRESS",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored BED-001-B: BED-001-DEMO, USD 3499 item cents + 900 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-BED-002-A",
      "subjectType": "seller",
      "subjectId": "DEMO-VALUE",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored BED-002-A: BED-002-DEMO, USD 5999 item cents + 500 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-BED-002-B",
      "subjectType": "seller",
      "subjectId": "DEMO-EXPRESS",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored BED-002-B: BED-002-DEMO, USD 6499 item cents + 900 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-BED-003-A",
      "subjectType": "seller",
      "subjectId": "DEMO-VALUE",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored BED-003-A: BED-003-DEMO, USD 4999 item cents + 500 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-BED-003-B",
      "subjectType": "seller",
      "subjectId": "DEMO-EXPRESS",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored BED-003-B: BED-003-DEMO, USD 5499 item cents + 900 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-BED-004-A",
      "subjectType": "seller",
      "subjectId": "DEMO-VALUE",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored BED-004-A: BED-004-DEMO, USD 3999 item cents + 500 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-BED-004-B",
      "subjectType": "seller",
      "subjectId": "DEMO-EXPRESS",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored BED-004-B: BED-004-DEMO, USD 4499 item cents + 900 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-BED-005-A",
      "subjectType": "seller",
      "subjectId": "DEMO-VALUE",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored BED-005-A: BED-005-DEMO, USD 19900 item cents + 0 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-BED-005-B",
      "subjectType": "seller",
      "subjectId": "DEMO-EXPRESS",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored BED-005-B: BED-005-DEMO, USD 20900 item cents + 900 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-BED-006-A",
      "subjectType": "seller",
      "subjectId": "DEMO-VALUE",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored BED-006-A: BED-006-DEMO, USD 37900 item cents + 0 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    },
    {
      "rating": null,
      "ratingCount": null,
      "writtenReviewCount": null,
      "purchaseCount": null,
      "purchaseCountPeriod": null,
      "reviewScope": null,
      "id": "FIXTURE-BED-006-B",
      "subjectType": "seller",
      "subjectId": "DEMO-EXPRESS",
      "sourceUrl": null,
      "sourceType": "fixture",
      "checkedOn": "2026-10-24",
      "classification": "proxy",
      "claim": "Authored BED-006-B: BED-006-DEMO, USD 38900 item cents + 900 shipping cents + 0 hardware cents; tax 0 in this fictional scenario. No live retail offer."
    }
  ],
  "scenarios": [
    {
      "now": "2026-10-24T10:00:00+08:00",
      "timezone": "Asia/Singapore",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "id": "cafe-dictation",
      "title": "Noisy-café dictation",
      "opening": "I dictate into my computer, but cafés are too noisy. What could help?",
      "anchorProductId": "MIC-044",
      "constraints": {
        "category": "audio-accessories",
        "currency": "USD",
        "budgetMinor": 16000,
        "hostConnection": "usb-c",
        "productId": "MIC-044"
      },
      "changes": [
        {
          "utterance": "Compare the offers for this directional USB microphone, with its required setup hardware.",
          "constraints": {},
          "expectedOfferIds": [
            "MIC-044-A",
            "MIC-044-B"
          ]
        },
        {
          "utterance": "I need it tomorrow.",
          "constraints": {
            "deadline": "2026-10-25T18:00:00+08:00"
          },
          "expectedOfferIds": [
            "MIC-044-B"
          ]
        },
        {
          "utterance": "Keep tomorrow, but the whole setup must cost no more than 140 dollars.",
          "constraints": {
            "budgetMinor": 14000
          },
          "expectedOfferIds": []
        }
      ]
    },
    {
      "now": "2026-10-24T10:00:00+08:00",
      "timezone": "Asia/Singapore",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "id": "work-gym",
      "title": "Bag inspiration / work and gym",
      "opening": "I like this bag's shape. I need a bag for work and gym under 150 dollars.",
      "anchorProductId": "BAG-001",
      "constraints": {
        "category": "everyday-bags",
        "currency": "USD",
        "budgetMinor": 15000,
        "laptopInches": 14,
        "separateShoeCompartment": true
      },
      "changes": [
        {
          "utterance": "Show offers with verified separate shoe storage and laptop support.",
          "constraints": {},
          "expectedOfferIds": [
            "BAG-001-A",
            "BAG-001-B"
          ]
        },
        {
          "utterance": "I need it tomorrow.",
          "constraints": {
            "deadline": "2026-10-25T18:00:00+08:00"
          },
          "expectedOfferIds": [
            "BAG-001-B"
          ]
        },
        {
          "utterance": "Keep everything else, but at most 100 dollars.",
          "constraints": {
            "budgetMinor": 10000
          },
          "expectedOfferIds": []
        }
      ]
    },
    {
      "now": "2026-10-24T10:00:00+08:00",
      "timezone": "Asia/Singapore",
      "destination": "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      "id": "warm-room",
      "title": "Bedsheets for a warm room",
      "opening": "My room gets hot at night; help me choose bedsheets.",
      "anchorProductId": "BED-003",
      "constraints": {
        "category": "bedsheet-sets",
        "currency": "USD",
        "budgetMinor": 7000,
        "bedWidthIn": 60,
        "bedLengthIn": 80,
        "mattressDepthIn": 12
      },
      "changes": [
        {
          "utterance": "Compare sets that fit my 12-inch-deep US Queen mattress.",
          "constraints": {},
          "expectedOfferIds": [
            "BED-002-A",
            "BED-003-A",
            "BED-003-B"
          ]
        },
        {
          "utterance": "I prefer the cotton-lyocell percale blend.",
          "constraints": {
            "productId": "BED-003"
          },
          "expectedOfferIds": [
            "BED-003-A",
            "BED-003-B"
          ]
        },
        {
          "utterance": "I need it tomorrow.",
          "constraints": {
            "deadline": "2026-10-25T18:00:00+08:00"
          },
          "expectedOfferIds": [
            "BED-003-B"
          ]
        },
        {
          "utterance": "Actually, keep these constraints but require 100% cotton.",
          "constraints": {
            "composition": "100% cotton"
          },
          "expectedOfferIds": []
        }
      ]
    }
  ],
  "knownLinks": [
    {
      "url": "https://www.apple.com/shop/product/myqy3am/a/earpods-usb-c",
      "productId": "MIC-001"
    },
    {
      "url": "https://www.logitech.com/en-us/shop/p/h390-usb-headset",
      "productId": "MIC-003"
    },
    {
      "url": "https://www.lenovo.com/us/en/p/accessories-and-software/audio/headsets/78806811",
      "productId": "MIC-009"
    },
    {
      "url": "https://www.sweetwater.com/store/detail/MV6G2K--shure-mv6-gen-2-usb-gaming-microphone-black",
      "productId": "MIC-015"
    },
    {
      "url": "https://fifinemicrophone.com/collections/microphones/products/fifine-ampligame-am8-microphone",
      "productId": "MIC-020"
    },
    {
      "url": "https://www.sweetwater.com/store/detail/NTUSBMini--rode-nt-usb-mini-usb-condenser-microphone",
      "productId": "MIC-022"
    },
    {
      "url": "https://www.logitechg.com/en-us/shop/p/snowball-ice-usb-microphone",
      "productId": "MIC-025"
    },
    {
      "url": "https://www.sweetwater.com/store/detail/LavalierGO--rode-lavalier-go-professional-wearable-microphone",
      "productId": "MIC-037"
    },
    {
      "url": "https://store.dji.com/product/dji-mic-mini",
      "productId": "MIC-038"
    },
    {
      "url": "https://www.sweetwater.com/store/detail/WirelessME--rode-wireless-me-clip-on-wireless-microphone-system",
      "productId": "MIC-040"
    },
    {
      "url": "https://www.sweetwater.com/store/detail/VideoMicGo2H--rode-videomic-go-ii-camera-mounted-shotgun-microphone",
      "productId": "MIC-044"
    },
    {
      "url": "https://shop.deitymic.com/products/d4-mini",
      "productId": "MIC-047"
    },
    {
      "url": "https://www.osprey.com/daylitetm-large-tote-pack",
      "productId": "BAG-001"
    },
    {
      "url": "https://www.osprey.com/daylite-tote-pack-daylttotpks21-779?color=Tumbleweed+Yellow%2FTunnel+Vision&size=O%2FS",
      "productId": "BAG-002"
    },
    {
      "url": "https://www.osprey.com/daylitetm-messenger",
      "productId": "BAG-003"
    },
    {
      "url": "https://www.osprey.com/daylitetm-duffel-30",
      "productId": "BAG-004"
    },
    {
      "url": "https://www.osprey.com/daylitetm-expandable-travel-pack-26-6",
      "productId": "BAG-005"
    },
    {
      "url": "https://www.osprey.com/daylitetm-plus-driftshade-backpack",
      "productId": "BAG-006"
    },
    {
      "url": "https://www.ikea.com/us/en/p/dvala-sheet-set-white-70577531/",
      "productId": "BED-001"
    },
    {
      "url": "https://www.ikea.com/us/en/p/nattjasmin-sheet-set-white-00601153/",
      "productId": "BED-002"
    },
    {
      "url": "https://www.ikea.com/us/en/p/ullvide-sheet-set-white-90577511/",
      "productId": "BED-003"
    },
    {
      "url": "https://www.ikea.com/us/en/p/solfibbla-sheet-set-white-green-stripe-60615835/",
      "productId": "BED-004"
    },
    {
      "url": "https://www.brooklinen.com/products/classic-core-sheet-set",
      "productId": "BED-005"
    },
    {
      "url": "https://www.brooklinen.com/products/washed-linen-core-sheet-set",
      "productId": "BED-006"
    }
  ],
  "imageFixtures": [
    {
      "id": "IMG-BAG-INSPIRATION",
      "image": {
        "url": "/catalog/images/bag.svg",
        "alt": "Authored blue tote illustration; not a photograph of any catalog product",
        "source": "Original project-owned SVG illustration, 2026-10-24",
        "classification": "proxy"
      },
      "productIds": [
        "BAG-001",
        "BAG-002",
        "BAG-003",
        "BAG-004",
        "BAG-005",
        "BAG-006"
      ],
      "description": "Shape/color inspiration only. Associations are curated candidate IDs, not image recognition results or evidence of size, material, laptop fit, or stock.",
      "correctionExample": "I meant the tote shape, not the blue color. I need a separate shoe compartment."
    },
    {
      "id": "IMG-BED-INSPIRATION",
      "image": {
        "url": "/catalog/images/bedding.svg",
        "alt": "Authored neutral bedding illustration; no actual material or mattress measurements shown",
        "source": "Original project-owned SVG illustration, 2026-10-24",
        "classification": "proxy"
      },
      "productIds": [
        "BED-001",
        "BED-002",
        "BED-003",
        "BED-004",
        "BED-005",
        "BED-006"
      ],
      "description": "Prepared bedding inspiration. Clarify dimensions, depth, composition and included pieces; none can be inferred from this illustration.",
      "correctionExample": "The mattress is twelve inches deep. I want plain white, not a particular fabric inferred from the picture."
    },
    {
      "id": "IMG-AUDIO-REFERENCE",
      "image": {
        "url": "/catalog/images/audio.svg",
        "alt": "Authored generic desktop microphone illustration; not a model photograph or measured recording setup",
        "source": "Original project-owned SVG illustration, 2026-10-24",
        "classification": "proxy"
      },
      "productIds": [
        "MIC-015",
        "MIC-020",
        "MIC-022"
      ],
      "description": "Generic desktop solution illustration only; does not establish model identity, compatibility or dictation performance.",
      "correctionExample": "I prefer something wearable; I do not want a desktop microphone."
    }
  ]
}
;
