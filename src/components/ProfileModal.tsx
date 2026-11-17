"use client";

import React, { useRef, useState } from "react";
import NextImage from "next/image";
import { Camera, Trash2, User, X } from "lucide-react";
import { useAppUI } from "@/app/Providers";
import { useVault } from "@/hooks/useVault";
import { Button } from "@/components/ui/button";

const MAX_AVATAR_PX = 160;

async function compressAvatarFile(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not read image file."));
      image.src = objectUrl;
    });

    const minSide = Math.min(img.width, img.height);
    const sx = Math.floor((img.width - minSide) / 2);
    const sy = Math.floor((img.height - minSide) / 2);
    const targetSize = Math.min(MAX_AVATAR_PX, minSide);

    const canvas = document.createElement("canvas");
    canvas.width = targetSize;
    canvas.height = targetSize;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas context is unavailable.");
    }

    ctx.drawImage(
      img,
      sx,
      sy,
      minSide,
      minSide,
      0,
      0,
      targetSize,
      targetSize
    );

    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

interface ProfileFormProps {
  initialName: string;
  initialAvatar: string | null;
  onClose: () => void;
}

function ProfileForm({
  initialName,
  initialAvatar,
  onClose,
}: ProfileFormProps) {
  const { showToast } = useAppUI();
  const { updateProfile } = useVault();
  const [displayName, setDisplayName] = useState(initialName);
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(
    initialAvatar
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (PNG, JPG, WebP).");
      return;
    }

    try {
      const compressed = await compressAvatarFile(file);
      setAvatarDataUrl(compressed);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to process image."
      );
    } finally {
      event.target.value = "";
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed) {
      setError("Display name cannot be empty.");
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile({
        displayName: trimmed,
        avatarDataUrl,
      });
      showToast("Profile updated locally.", "success");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const initials = (displayName || "R").trim().slice(0, 2).toUpperCase();

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-primary/40 bg-muted shadow-sm">
          {avatarDataUrl ? (
            <NextImage
              src={avatarDataUrl}
              alt="Avatar preview"
              width={80}
              height={80}
              unoptimized
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary to-[#63e] text-xl font-bold text-white">
              {initials}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="h-3.5 w-3.5" />
              <span>Upload Photo</span>
            </Button>
            {avatarDataUrl ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAvatarDataUrl(null)}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Remove</span>
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Cropped & compressed locally to 160×160 px inside IndexedDB.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="profile-display-name"
          className="text-xs font-semibold text-foreground"
        >
          Display Name
        </label>
        <div className="relative">
          <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="profile-display-name"
            type="text"
            maxLength={40}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Reader"
            className="h-10 w-full rounded-xl border border-border bg-background/80 pl-9 pr-3 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Profile"}
        </Button>
      </div>
    </form>
  );
}

export function ProfileModal() {
  const { isProfileOpen, setIsProfileOpen } = useAppUI();
  const { profile } = useVault();

  if (!isProfileOpen) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setIsProfileOpen(false);
        }
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card-solid p-6 shadow-2xl animate-word-drop">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2
              id="profile-modal-title"
              className="text-lg font-bold text-foreground"
            >
              Local Profile
            </h2>
            <p className="text-xs text-muted-foreground">
              Stored strictly in your browser, never uploaded.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsProfileOpen(false)}
            aria-label="Close profile dialog"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ProfileForm
          key={`${profile.displayName}-${profile.avatarDataUrl ? "img" : "none"}`}
          initialName={profile.displayName}
          initialAvatar={profile.avatarDataUrl}
          onClose={() => setIsProfileOpen(false)}
        />
      </div>
    </div>
  );
}
