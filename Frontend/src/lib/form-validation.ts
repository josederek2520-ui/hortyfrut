export type FormControl =
  HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
export interface ValidationIssue {
  code:
    | "required"
    | "email"
    | "digits"
    | "minLength"
    | "maxLength"
    | "futureDate"
    | "invalid";
  values?: Record<string, number>;
}
export type FieldErrors = Record<string, string[]>;

export function getControlIssue(control: FormControl): ValidationIssue | null {
  if (!control.willValidate || control.disabled) return null;
  const value = control.value;
  const validity = control.validity;
  if (
    validity.valueMissing ||
    (control.required && control.type !== "password" && !value.trim())
  )
    return { code: "required" };
  if (validity.typeMismatch && control.type === "email")
    return { code: "email" };
  if (
    validity.patternMismatch &&
    control instanceof HTMLInputElement &&
    ["[0-9]*", "[0-9]+"].includes(control.pattern)
  )
    return { code: "digits" };
  if (validity.rangeOverflow && control.type === "date")
    return { code: "futureDate" };
  if (
    "minLength" in control &&
    value &&
    control.minLength > 0 &&
    value.length < control.minLength
  )
    return { code: "minLength", values: { min: control.minLength } };
  if (
    "maxLength" in control &&
    control.maxLength > 0 &&
    value.length > control.maxLength
  )
    return { code: "maxLength", values: { max: control.maxLength } };
  return validity.valid ? null : { code: "invalid" };
}

export function getFormErrors(
  form: HTMLFormElement,
  translate: (issue: ValidationIssue) => string,
): FieldErrors {
  const errors: FieldErrors = {};
  for (const element of Array.from(form.elements)) {
    if (
      !(
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement
      ) ||
      !element.name
    )
      continue;
    const issue = getControlIssue(element);
    if (issue) errors[element.name] = [translate(issue)];
  }
  return errors;
}

export function focusInvalidField(form: HTMLFormElement) {
  requestAnimationFrame(() =>
    form
      .querySelector<HTMLElement>(
        '[aria-invalid="true"], [data-invalido="true"]',
      )
      ?.focus(),
  );
}
