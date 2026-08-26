# YadavBrowser — Chrome/Edge Foundation Roadmap

This document tracks the browser features to build without breaking the existing YadavBrowser and AARYA architecture.

## Core
- [ ] Reliable normal/private tab lifecycle
- [ ] Correct new-window and target=_blank handling
- [ ] Loading/progress state
- [ ] Error page and offline handling
- [ ] HTTPS/security indicator
- [ ] Recently closed tabs
- [ ] Tab context menu

## Navigation
- [ ] Find in page
- [ ] Zoom controls
- [ ] Save page
- [ ] Print page
- [ ] View source / DevTools
- [ ] Link context actions

## Browser data
- [ ] History management
- [ ] Bookmark folders
- [ ] Download manager
- [ ] Clear browsing data
- [ ] Private-session isolation

## Product
- [ ] Settings page
- [ ] Keyboard shortcut help
- [ ] Custom new-tab page
- [ ] Yadav Search
- [ ] AARYA integration
- [ ] Chess integration

## Quality bar
Every feature must be tested on Windows Electron before being considered stable. Never commit API keys or `.env` files.
