var comment = {}
comment['link'] = 'https://www.ohmysites.com'

comment['link'] = comment['link']?(/^https?\:\/\//.test(comment['link']) ? comment['link'] : 'http://'+comment['link']) : '';

console.log(comment['link'])