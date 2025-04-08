async function getData(url) {
  var data;
  const request = new Request(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  await fetch(request)
    .then((response) => response.json())
    .then((json) => {
      data = json;
    })
    .catch(console.error);

  return data;
}

async function postData(url, data) {
  var data;
  const request = new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data)
  });

  await fetch(request)
    .then((response) => response.json())
    .then((json) => {
      data = json;
    })
    .catch(console.error);

  return data;
}
