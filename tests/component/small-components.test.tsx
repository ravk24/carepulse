import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DoctorAvatar } from "@/components/DoctorAvatar";
import { FileUploader } from "@/components/FileUploader";
import { Logo } from "@/components/Logo";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import SubmitButton from "@/components/SubmitButton";
import { DataTable } from "@/components/table/DataTable";

describe("DoctorAvatar", () => {
  it.each([
    ["Naresh Trehan", "NT"],
    ["Devi Prasad Shetty", "DS"], // first + last word
    ["D. Nageshwar Reddy", "DR"],
    ["Dr. Ashok Seth", "AS"], // "Dr." prefix is ignored
    ["Madonna", "Ma"], // single word -> first two letters (CSS uppercases them)
    ["", "?"],
  ])("BK-15 %j -> %j", (name, initials) => {
    const { container } = render(<DoctorAvatar name={name} />);
    expect(container.textContent).toBe(initials);
  });

  it("is hidden from screen readers (the doctor's name is next to it)", () => {
    const { container } = render(<DoctorAvatar name="Atul Goel" />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });
});

describe("SubmitButton", () => {
  it("shows its label when idle", () => {
    render(<SubmitButton isLoading={false}>Go</SubmitButton>);
    expect(screen.getByRole("button", { name: "Go" })).toBeEnabled();
  });

  it("UI-07 shows a spinner and is disabled while loading", () => {
    render(<SubmitButton isLoading>Go</SubmitButton>);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Loading...");
  });
});

describe("Logo", () => {
  it("UI-06 links to the home page", () => {
    render(<Logo />);
    expect(screen.getByRole("link", { name: "CarePulse home" })).toHaveAttribute("href", "/");
  });
});

describe("StatusBadge / StatCard", () => {
  it.each(["scheduled", "pending", "cancelled"] as const)("renders %s", (status) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(status)).toBeInTheDocument();
  });

  it("StatCard shows count and label", () => {
    render(<StatCard type="pending" count={7} label="Pending" icon="/x.svg" />);
    expect(screen.getByRole("heading", { name: "7" })).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });
});

describe("FileUploader", () => {
  it("UI-10 passes the selected file to onChange", async () => {
    const onChange = vi.fn();
    const { container } = render(<FileUploader files={[]} onChange={onChange} />);
    const file = new File(["fake"], "id.png", { type: "image/png" });

    await userEvent.upload(container.querySelector("input[type=file]") as HTMLInputElement, file);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([file]));
  });

  it("UI-10 shows a preview once a file is set", () => {
    // jsdom has no URL.createObjectURL
    URL.createObjectURL = vi.fn(() => "blob:preview");
    const file = new File(["fake"], "id.png", { type: "image/png" });
    render(<FileUploader files={[file]} onChange={vi.fn()} />);
    expect(screen.getByAltText("uploaded image")).toBeInTheDocument();
  });
});

describe("DataTable", () => {
  const columns = [{ accessorKey: "n", header: "N" }];

  it("shows 'No results.' for an empty list", () => {
    render(<DataTable columns={columns} data={[]} />);
    expect(screen.getByText("No results.")).toBeInTheDocument();
  });

  it("UI-09 pages through more than 10 rows", () => {
    const data = Array.from({ length: 12 }, (_, i) => ({ n: `row-${i + 1}` }));
    render(<DataTable columns={columns} data={data} />);
    const [prev, next] = screen.getAllByRole("button");

    expect(screen.getByText("row-1")).toBeInTheDocument();
    expect(screen.queryByText("row-11")).not.toBeInTheDocument();
    expect(prev).toBeDisabled();

    fireEvent.click(next);
    expect(screen.getByText("row-11")).toBeInTheDocument();
    expect(screen.queryByText("row-1")).not.toBeInTheDocument();
    expect(next).toBeDisabled();
  });
});
