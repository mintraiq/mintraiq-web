function upload() {


    const input = document.getElementById('receipt-upload');
    const formData = new FormData();
    formData.append("file", input.files[0]);


     if (data) {
    fetch("/api/upload-receipt", {
        method: "POST",
        body: formData,
        credentials: 'include'
    })
    .then(res => {
        if (!res.ok) throw new Error("Upload failed");
        return res.json();
    })
    .then(data => {
        displayResult(data);
    })
    .catch(err => alert(err.message));
}

function displayResult(data) {
    alert(data)
    document.getElementById("resultCard").style.display = "block";
    document.getElementById("merchant").innerText = data.merchant_name|| "N/A";
    document.getElementById("amount").innerText = data.total_amount || "0.00";
    document.getElementById("category").innerText = data.category || "Uncategorized";

    const tbody = document.getElementById("linesTableBody");
    tbody.innerHTML = ""; // clear previous rows

    (data.line_items || []).forEach((line, index) => {
        const row = document.createElement("tr");

        const item_name = document.createElement("td");
        item_name.textContent = line.item_name;

        const item_quantity = document.createElement("td");
        item_quantity.textContent = line.item_quantity;

        const item_price = document.createElement("td");
        item_price.textContent = line.item_price;

        row.appendChild(item_name);
        row.appendChild(item_quantity);
        row.appendChild(item_price)

        tbody.appendChild(row);
    });
}