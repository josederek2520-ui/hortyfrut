"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import { DeleteIcon } from "@/icons";
import { api, ApiError } from "@/lib/api";
import type { RoleRow } from "./types";
interface Props {
  role: RoleRow;
  onClose: () => void;
  onSaved: () => void;
  onError: (error: unknown) => void;
}
export default function RoleDeleteDialog({
  role,
  onClose,
  onSaved,
  onError,
}: Props) {
  const t = useTranslations("roles");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      await api(`roles/${role.id}/`, {
        method: "DELETE",
        body: JSON.stringify({ version: role.version }),
      });
      onSaved();
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 409
          ? t("conflict")
          : caught instanceof ApiError && caught.status === 400
            ? caught.errors.detail?.join(" ") || t("assignedDeleteError")
            : t("deleteError"),
      );
      onError(caught);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      isOpen
      onClose={() => {
        if (!busy) onClose();
      }}
      className="max-w-md"
      labelledBy="role-delete-title"
      closeLabel={t("close")}
    >
      <div className="p-6 sm:p-8">
        <span className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-error-50 text-error-500 dark:bg-error-500/10 dark:text-error-400">
          <DeleteIcon className="size-6" />
        </span>
        <h2
          id="role-delete-title"
          className="text-xl font-semibold text-gray-900 dark:text-white"
        >
          {t("deleteTitle")}
        </h2>
        <p className="mt-3 text-sm leading-6 break-words text-gray-500 dark:text-gray-400">
          {t("deleteConfirm", { name: role.name })}
        </p>
        {error && (
          <p role="alert" className="mt-4 text-sm text-error-500">
            {error}
          </p>
        )}
        <div className="mt-7 flex justify-end gap-3">
          <Button size="sm" variant="outline" disabled={busy} onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            size="sm"
            disabled={busy}
            onClick={() => void remove()}
            variant="danger"
          >
            {t(busy ? "deleting" : "delete")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
