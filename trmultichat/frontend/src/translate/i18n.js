import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import { messages } from "./languages";

i18n.use(LanguageDetector).init({
	debug: false,
	lng: "pt",
	defaultNS: ["translations"],
	fallbackLng: "pt",
	supportedLngs: ["pt"],
	nonExplicitSupportedLngs: true,
	load: "languageOnly",
	ns: ["translations"],
	resources: messages,
});

export { i18n };
