import React from 'react';
import AvatarUploader from '../components/profile/AvatarUploader.jsx';
import ProfileForm from '../components/profile/ProfileForm.jsx';
import StatsGrid from '../components/profile/StatsGrid.jsx';

export default function ProfilePage() {
  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <h1 className="text-2xl font-bold">Profile</h1>
      <div className="bg-gray-900 rounded-xl p-6 flex flex-col items-center gap-4">
        <AvatarUploader />
        <StatsGrid />
      </div>
      <div className="bg-gray-900 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Edit Profile</h2>
        <ProfileForm />
      </div>
    </div>
  );
}
