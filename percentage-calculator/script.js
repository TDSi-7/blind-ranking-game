function parseNumber(value) {
    if (value.trim() === "") {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value) {
    if (!Number.isFinite(value)) {
        return "Invalid number";
    }

    return Number(value.toFixed(6)).toString();
}

function setAnswer(element, text, isError) {
    element.value = text;
    element.classList.toggle("error", Boolean(isError));
}

function handlePercentOf() {
    const percent = parseNumber(document.getElementById("percentOfPercent").value);
    const base = parseNumber(document.getElementById("percentOfBase").value);
    const output = document.getElementById("percentOfAnswer");

    if (percent === null || base === null) {
        setAnswer(output, "Please enter valid numbers in both fields.", true);
        return;
    }

    const result = (percent / 100) * base;
    setAnswer(output, formatNumber(result), false);
}

function handleWhatPercent() {
    const value = parseNumber(document.getElementById("whatPercentValue").value);
    const total = parseNumber(document.getElementById("whatPercentTotal").value);
    const output = document.getElementById("whatPercentAnswer");

    if (value === null || total === null) {
        setAnswer(output, "Please enter valid numbers in both fields.", true);
        return;
    }

    if (total === 0) {
        setAnswer(output, "Cannot divide by zero. The second number must not be 0.", true);
        return;
    }

    const result = (value / total) * 100;
    setAnswer(output, `${formatNumber(result)}%`, false);
}

function handleChange() {
    const fromValue = parseNumber(document.getElementById("changeFrom").value);
    const toValue = parseNumber(document.getElementById("changeTo").value);
    const output = document.getElementById("changeAnswer");

    if (fromValue === null || toValue === null) {
        setAnswer(output, "Please enter valid numbers in both fields.", true);
        return;
    }

    if (fromValue === 0) {
        setAnswer(output, "Cannot calculate percentage change from 0.", true);
        return;
    }

    const percentChange = ((toValue - fromValue) / fromValue) * 100;
    const direction = percentChange > 0 ? "increase" : percentChange < 0 ? "decrease" : "no change";
    const magnitude = Math.abs(percentChange);

    if (direction === "no change") {
        setAnswer(output, "0% (no change)", false);
        return;
    }

    setAnswer(output, `${formatNumber(magnitude)}% ${direction}`, false);
}

document.getElementById("percentOfBtn").addEventListener("click", handlePercentOf);
document.getElementById("whatPercentBtn").addEventListener("click", handleWhatPercent);
document.getElementById("changeBtn").addEventListener("click", handleChange);
