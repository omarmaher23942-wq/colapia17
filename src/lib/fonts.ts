import { Cairo, Tajawal, IBM_Plex_Sans_Arabic, Almarai, Changa, El_Messiri, Readex_Pro, Noto_Kufi_Arabic } from "next/font/google";

/** كل الخطوط مُعرّفة كمتغيرات؛ المتصفح يحمّل فقط ما يستخدمه المتجر فعليًا */
export const fontCairo = Cairo({ subsets: ["arabic", "latin"], variable: "--font-cairo", display: "swap" });
export const fontTajawal = Tajawal({ subsets: ["arabic", "latin"], weight: ["400", "500", "700", "800"], variable: "--font-tajawal", display: "swap", preload: false });
export const fontIbm = IBM_Plex_Sans_Arabic({ subsets: ["arabic", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-ibm-plex-arabic", display: "swap", preload: false });
export const fontAlmarai = Almarai({ subsets: ["arabic"], weight: ["300", "400", "700", "800"], variable: "--font-almarai", display: "swap", preload: false });
export const fontChanga = Changa({ subsets: ["arabic", "latin"], variable: "--font-changa", display: "swap", preload: false });
export const fontMessiri = El_Messiri({ subsets: ["arabic", "latin"], variable: "--font-el-messiri", display: "swap", preload: false });
export const fontReadex = Readex_Pro({ subsets: ["arabic", "latin"], variable: "--font-readex-pro", display: "swap", preload: false });
export const fontKufi = Noto_Kufi_Arabic({ subsets: ["arabic"], variable: "--font-noto-kufi", display: "swap", preload: false });

export const fontVariables = [fontCairo, fontTajawal, fontIbm, fontAlmarai, fontChanga, fontMessiri, fontReadex, fontKufi].map((f) => f.variable).join(" ");
