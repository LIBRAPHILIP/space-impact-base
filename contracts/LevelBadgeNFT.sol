// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LevelBadgeNFT
 * @notice Per-level achievement badges for Space Impact // Neon Genesis on Base.
 *         Each wallet may mint each level badge once after clearing that sector.
 */
contract LevelBadgeNFT {
    string public name = "Space Impact Neon Genesis";
    string public symbol = "SING";

    uint256 public totalSupply;
    address public owner;

    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    mapping(address => mapping(uint256 => bool)) public hasMintedLevel;
    mapping(uint256 => uint256) public tokenLevel;
    mapping(uint256 => uint256) public tokenScore;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event LevelBadgeMinted(
        address indexed player,
        uint256 indexed level,
        uint256 indexed tokenId,
        uint256 score
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return
            interfaceId == 0x01ffc9a7 || // ERC165
            interfaceId == 0x80ac58cd || // ERC721
            interfaceId == 0x5b5e139f; // ERC721Metadata
    }

    function balanceOf(address account) external view returns (uint256) {
        require(account != address(0), "zero address");
        return _balances[account];
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address o = _owners[tokenId];
        require(o != address(0), "nonexistent");
        return o;
    }

    function approve(address to, uint256 tokenId) external {
        address o = ownerOf(tokenId);
        require(to != o, "self approve");
        require(msg.sender == o || isApprovedForAll(o, msg.sender), "not approved");
        _tokenApprovals[tokenId] = to;
        emit Approval(o, to, tokenId);
    }

    function getApproved(uint256 tokenId) public view returns (address) {
        require(_owners[tokenId] != address(0), "nonexistent");
        return _tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) external {
        require(operator != msg.sender, "self operator");
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address account, address operator) public view returns (bool) {
        return _operatorApprovals[account][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        require(_isApprovedOrOwner(msg.sender, tokenId), "not allowed");
        require(ownerOf(tokenId) == from, "wrong from");
        require(to != address(0), "zero to");
        delete _tokenApprovals[tokenId];
        _balances[from] -= 1;
        _balances[to] += 1;
        _owners[tokenId] = to;
        emit Transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata) external {
        transferFrom(from, to, tokenId);
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address o = ownerOf(tokenId);
        return (spender == o || getApproved(tokenId) == spender || isApprovedForAll(o, spender));
    }

    /**
     * @notice Mint a badge for a cleared level. One mint per (player, level).
     * @dev Client-trust model for arcade demos. For production, gate with signatures.
     */
    function mintLevelBadge(uint256 level, uint256 score) external returns (uint256 tokenId) {
        require(level >= 1 && level <= 100, "invalid level");
        require(!hasMintedLevel[msg.sender][level], "already minted");

        hasMintedLevel[msg.sender][level] = true;
        tokenId = ++totalSupply;
        _owners[tokenId] = msg.sender;
        _balances[msg.sender] += 1;
        tokenLevel[tokenId] = level;
        tokenScore[tokenId] = score;

        emit Transfer(address(0), msg.sender, tokenId);
        emit LevelBadgeMinted(msg.sender, level, tokenId, score);
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        require(_owners[tokenId] != address(0), "nonexistent");
        uint256 level = tokenLevel[tokenId];
        uint256 score = tokenScore[tokenId];
        string memory json = string(
            abi.encodePacked(
                '{"name":"Space Impact Level ',
                _toString(level),
                ' Badge","description":"Neon Genesis sector clear badge on Base.","attributes":[',
                '{"trait_type":"Level","value":',
                _toString(level),
                '},{"trait_type":"Score","value":',
                _toString(score),
                '},{"trait_type":"Chain","value":"Base"}],',
                '"image":"data:image/svg+xml;base64,',
                _svgB64(level),
                '"}'
            )
        );
        return string(abi.encodePacked("data:application/json;utf8,", json));
    }

    function _svgB64(uint256 level) internal pure returns (string memory) {
        // Lightweight inline SVG (not base64 for simplicity — JSON uses raw utf8 data URI)
        // Returning a placeholder path encoded as plain svg reference in image field via utf8 escape
        // Use hex color neon badge
        bytes memory svg = abi.encodePacked(
            "<svg xmlns='http://www.w3.org/2000/svg' width='512' height='512'>",
            "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>",
            "<stop stop-color='#00f0ff'/><stop offset='1' stop-color='#ff2bd6'/></linearGradient></defs>",
            "<rect width='512' height='512' fill='#05060f'/>",
            "<rect x='32' y='32' width='448' height='448' rx='36' fill='url(#g)' opacity='0.2' stroke='#00f0ff' stroke-width='4'/>",
            "<text x='256' y='230' fill='#00f0ff' font-size='42' font-family='monospace' text-anchor='middle'>LEVEL</text>",
            "<text x='256' y='310' fill='#ff2bd6' font-size='96' font-family='monospace' text-anchor='middle' font-weight='700'>",
            _toString(level),
            "</text>",
            "<text x='256' y='380' fill='#b8ff3c' font-size='22' font-family='monospace' text-anchor='middle'>NEON GENESIS / BASE</text>",
            "</svg>"
        );
        return _encode(svg);
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    /// @dev minimal base64 encoder for SVG
    function _encode(bytes memory data) internal pure returns (string memory) {
        string memory table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        uint256 len = data.length;
        if (len == 0) return "";
        uint256 encodedLen = 4 * ((len + 2) / 3);
        bytes memory result = new bytes(encodedLen);
        bytes memory tableBytes = bytes(table);
        uint256 i;
        uint256 j;
        for (i = 0; i + 3 <= len; i += 3) {
            uint256 n = (uint256(uint8(data[i])) << 16) |
                (uint256(uint8(data[i + 1])) << 8) |
                uint256(uint8(data[i + 2]));
            result[j++] = tableBytes[(n >> 18) & 63];
            result[j++] = tableBytes[(n >> 12) & 63];
            result[j++] = tableBytes[(n >> 6) & 63];
            result[j++] = tableBytes[n & 63];
        }
        if (len - i == 1) {
            uint256 n1 = uint256(uint8(data[i])) << 16;
            result[j++] = tableBytes[(n1 >> 18) & 63];
            result[j++] = tableBytes[(n1 >> 12) & 63];
            result[j++] = bytes1("=");
            result[j++] = bytes1("=");
        } else if (len - i == 2) {
            uint256 n2 = (uint256(uint8(data[i])) << 16) | (uint256(uint8(data[i + 1])) << 8);
            result[j++] = tableBytes[(n2 >> 18) & 63];
            result[j++] = tableBytes[(n2 >> 12) & 63];
            result[j++] = tableBytes[(n2 >> 6) & 63];
            result[j++] = bytes1("=");
        }
        return string(result);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero");
        owner = newOwner;
    }
}
