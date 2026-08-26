# AARYA

AARYA is the AI assistant layer for YadavBrowser.

## Goals

- Provider-agnostic AI architecture
- Fast provider selection and fallback
- Browser-aware assistance
- No API keys committed to source control
- Easy integration with the YadavBrowser Electron application

## Planned structure

```text
aarya/
├── core.js
├── providers/
│   ├── gemini.js
│   ├── openai.js
│   └── custom.js
└── README.md
```

AARYA will be integrated into the browser after the provider layer is configured.
