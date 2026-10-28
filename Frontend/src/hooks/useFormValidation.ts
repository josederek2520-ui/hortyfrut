"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  focusInvalidField,
  getControlIssue,
  getFormErrors,
  type FieldErrors,
  type FormControl,
  type ValidationIssue,
} from "@/lib/form-validation";

export function useFormValidation() {
  const t = useTranslations("users");
  const [errors, setErrors] = useState<FieldErrors>({});
  const attempted = useRef(false);
  const translate = useCallback(
    (issue: ValidationIssue) => t(`validation.${issue.code}`, issue.values),
    [t],
  );

  const validateForm = useCallback(
    (form: HTMLFormElement, extra: FieldErrors = {}) => {
      attempted.current = true;
      const next = { ...getFormErrors(form, translate), ...extra };
      setErrors(next);
      if (Object.keys(next).length) {
        focusInvalidField(form);
        return false;
      }
      return true;
    },
    [translate],
  );

  const changeField = useCallback(
    (control: FormControl) => {
      const name = control.name;
      const issue = getControlIssue(control);
      const hasAttempted = attempted.current;
      const messages = issue ? [translate(issue)] : [];
      setErrors((current) =>
        hasAttempted || current[name]?.length
          ? { ...current, [name]: messages }
          : current,
      );
    },
    [translate],
  );

  const blurField = useCallback(
    (control: FormControl) => {
      const name = control.name;
      const issue = getControlIssue(control);
      setErrors((current) => ({
        ...current,
        [name]: issue ? [translate(issue)] : [],
      }));
    },
    [translate],
  );

  return { errors, setErrors, validateForm, changeField, blurField };
}
