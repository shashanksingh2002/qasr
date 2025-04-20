"use client";

import { useState } from "react";

interface Video {
  title: string;
  link: string;
}

export default function VideosTab() {
  const [recentVideos] = useState<Video[]>([
      { title: "Room 1 Video", link: "/video/1" },
      { title: "Room 2 Video", link: "/video/2" },
    ]);

  return (
    <div>
      {recentVideos.length > 0 ? (
        <ul>
          {recentVideos.map((video, idx) => (
            <li key={idx} className="mb-2">
              <a href={video.link} className="text-blue-500 hover:underline">
                {video.title}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p>No recent videos available.</p>
      )}
    </div>
  );
}
