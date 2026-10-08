import { genUploader } from "uploadthing/client";
import type { AppFileRouter } from "@/app/api/uploadthing/core";

export const { uploadFiles } = genUploader<AppFileRouter>();