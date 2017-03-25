/*
 * Copyright 2012, 2017 Matt Kenney
 *
 * This file is part of Boksen.
 *
 * Boksen is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option) any
 * later version.
 *
 * Boksen is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Boksen.  If not, see <http://www.gnu.org/licenses/>.
 */

var encode = module.exports =
{
    encode: function (value, special, allowed)
    {
        special = special || '%';
        allowed = allowed || '';
        text = unescape(encodeURIComponent(value));
        buf = []
        for (var i = 0; i < text.length; i++)
        {
            var c = text.charAt(i);
            if ((('a' <= c && c <= 'z') || ('A' <= c && c <= 'Z') || ('0' <= c && c <= '9') || (allowed.indexOf(c) >= 0)) && c != special)
            {
                buf.push(c);
            }
            else
            {
                buf.push(special);
                buf.push((0x100 + c.charCodeAt(0)).toString(16).substring(1, 3).toUpperCase());
            }
        }
        return buf.join('');
    },

    encode_segment: function (value)
    {
        return encode.encode(value, '_', '-.');
    },

    ab64decode: function (data)
    {
        var result = (new Buffer(data.replace(/\./g, '+'), 'base64').toString('binary'));
        return result;
    },

    ab64encode: function (data)
    {
        var result = (
            new Buffer(data, 'binary')
            .toString('base64')
            .replace(/\+/g, '.')
            .replace(/=/g, '')
        );
        return result;
    }
};
