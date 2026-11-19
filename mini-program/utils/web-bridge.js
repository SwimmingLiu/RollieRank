const PUBLISHERS = ["四海", "超格", "粉笔", "上岸村"];

function linkQuery({ institution, period, paper }) {
  const collection = Number(period);
  const booklet = Number(paper);
  if (!PUBLISHERS.includes(institution) || !Number.isInteger(collection) || collection < 1 || collection > 999 ||
    !Number.isInteger(booklet) || booklet < 1 || booklet > 300) return "";
  return "&open=paper&institution=" + encodeURIComponent(institution) + "&period=" + collection + "&paper=" + booklet;
}

function validTicket(ticket) {
  return typeof ticket === "string" && /^[a-f0-9]{48}$/.test(ticket);
}

module.exports = { linkQuery, validTicket };
