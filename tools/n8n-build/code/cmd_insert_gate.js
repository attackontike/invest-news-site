const { insert } = $('처리 결정').first().json;
return insert ? [{ json: { rows: [{ ...insert, added_at: new Date().toISOString() }] } }] : [];
