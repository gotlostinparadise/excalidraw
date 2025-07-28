import { MIME_TYPES } from "@excalidraw/common";
import { decompressData } from "@excalidraw/excalidraw/data/encode";
import type { BinaryFileData, BinaryFileMetadata, DataURL } from "@excalidraw/excalidraw/types";
import type { FileId } from "@excalidraw/element/types";

const FILES_BACKEND = import.meta.env.VITE_APP_FILES_BACKEND_URL;

export const saveFilesToServer = async ({
  prefix,
  files,
}: {
  prefix: string;
  files: { id: FileId; buffer: Uint8Array }[];
}) => {
  const savedFiles: FileId[] = [];
  const erroredFiles: FileId[] = [];

  await Promise.all(
    files.map(async ({ id, buffer }) => {
      try {
        await fetch(
          `${FILES_BACKEND}/upload?prefix=${encodeURIComponent(prefix)}&id=${id}`,
          {
            method: "POST",
            body: buffer,
          },
        );
        savedFiles.push(id);
      } catch (error: any) {
        erroredFiles.push(id);
      }
    }),
  );

  return { savedFiles, erroredFiles };
};

export const loadFilesFromServer = async (
  prefix: string,
  decryptionKey: string,
  fileIds: readonly FileId[],
) => {
  const loadedFiles: BinaryFileData[] = [];
  const erroredFiles = new Map<FileId, true>();

  await Promise.all(
    [...new Set(fileIds)].map(async (id) => {
      try {
        const response = await fetch(
          `${FILES_BACKEND}?prefix=${encodeURIComponent(prefix)}&id=${id}`,
        );
        if (response.status < 400) {
          const arrayBuffer = await response.arrayBuffer();

          const { data, metadata } = await decompressData<BinaryFileMetadata>(
            new Uint8Array(arrayBuffer),
            {
              decryptionKey,
            },
          );

          const dataURL = new TextDecoder().decode(data) as DataURL;

          loadedFiles.push({
            mimeType: metadata.mimeType || MIME_TYPES.binary,
            id,
            dataURL,
            created: metadata?.created || Date.now(),
            lastRetrieved: metadata?.created || Date.now(),
          });
        } else {
          erroredFiles.set(id, true);
        }
      } catch (error: any) {
        erroredFiles.set(id, true);
        console.error(error);
      }
    }),
  );

  return { loadedFiles, erroredFiles };
};
