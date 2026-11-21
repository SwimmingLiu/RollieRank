function placeLeaderboardRows(result) {
  const offset = (result.page - 1) * result.pageSize;
  return (result.rows || []).map((row, index) => ({
    ...row,
    place: offset + index + 1,
    placeText: String(offset + index + 1).padStart(2, "0"),
  }));
}

module.exports = { placeLeaderboardRows };
