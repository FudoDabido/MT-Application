import React, { useState } from 'react';

export default function VideoUploader({ onFile }) {
  const [preview, setPreview] = useState(null);

  function handleChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    onFile(file);
    setPreview(URL.createObjectURL(file));
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm text-gray-400">Video Proof (optional)</label>
      <label className="cursor-pointer border-2 border-dashed border-gray-700 rounded-lg p-4 text-center hover:border-emerald-500 transition-colors">
        <input type="file" accept="video/*" className="hidden" onChange={handleChange} />
        {preview ? (
          <video src={preview} controls className="max-h-32 mx-auto rounded" />
        ) : (
          <span className="text-gray-500 text-sm">Click to upload video</span>
        )}
      </label>
    </div>
  );
}
